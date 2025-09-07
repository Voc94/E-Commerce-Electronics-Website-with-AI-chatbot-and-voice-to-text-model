// src/main/java/com/spark/electronics_store/service/ProductService.java
package com.spark.electronics_store.service;

import com.spark.electronics_store.dto.CreateProductRequest;
import com.spark.electronics_store.dto.ProductPhotoResponse;
import com.spark.electronics_store.dto.ProductResponse;
import com.spark.electronics_store.dto.UpdateProductRequest;
import com.spark.electronics_store.model.Brand;
import com.spark.electronics_store.model.Product;
import com.spark.electronics_store.model.ProductCategory;
import com.spark.electronics_store.model.ProductStatus;
import com.spark.electronics_store.repository.BrandRepository;
import com.spark.electronics_store.repository.ProductRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

import static com.spark.electronics_store.repository.spec.ProductSpecifications.*;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final BrandRepository brandRepository;
    private final ProductRepository productRepository;
    private final ProductPhotoService photoService;

    private ProductResponse toResponse(Product p) {
        List<ProductPhotoResponse> photoDtos = new ArrayList<>();
        if (p.getPhotos() != null) {
            for (var ph : p.getPhotos()) {
                String url = String.format("/brands/%s/products/%s/photos/%s",
                        p.getBrand().getId(), p.getId(), ph.getId());
                photoDtos.add(new ProductPhotoResponse(
                        ph.getId(),
                        ph.getFilename(),
                        ph.getContentType(),
                        ph.getPosition() == null ? 0 : ph.getPosition(),
                        ph.isPrimary(),
                        url
                ));
            }
            photoDtos.sort(Comparator.comparingInt(ProductPhotoResponse::position));
        }

        return new ProductResponse(
                p.getId(),
                p.getName(),
                p.getSlug(),
                p.getDescription(),
                p.getPrice(),
                p.getCurrency(),
                p.getCategory(),
                p.getStatus(),
                photoDtos
        );
    }

    @Transactional
    public ProductResponse create(UUID brandId, CreateProductRequest req, MultipartFile[] photos) {
        Brand brand = brandRepository.findById(brandId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Brand not found"));

        Product product = Product.builder()
                .id(UUID.randomUUID())
                .brand(brand)
                .name(req.name())
                .slug(req.slug())
                .description(req.description())
                .price(req.price() != null ? new BigDecimal(req.price()) : null)
                .currency(req.currency())
                .status(ProductStatus.ACTIVE)
                .deleted(false)
                .build();

        product = productRepository.save(product);

        if (photos != null && photos.length > 0) {
            photoService.addPhotos(brandId, product.getId(), Arrays.asList(photos));
        }

        // Reload to include persisted photos (if eager, you can skip)
        product = productRepository.findById(product.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Product reload failed"));
        return toResponse(product);
    }

    @Transactional
    public ProductResponse update(UUID brandId, UUID productId, UpdateProductRequest req, List<MultipartFile> newPhotos) {
        Product existing = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Product not found"));
        if (!existing.getBrand().getId().equals(brandId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Brand mismatch");
        }

        if (req.name() != null) existing.setName(req.name());
        if (req.slug() != null) existing.setSlug(req.slug());
        if (req.description() != null) existing.setDescription(req.description());
        if (req.price() != null) existing.setPrice(new BigDecimal(req.price()));
        if (req.currency() != null) existing.setCurrency(req.currency());
        if (req.status() != null) existing.setStatus(req.status());
        if (req.category() != null) existing.setCategory(req.category());

        existing = productRepository.save(existing);

        if (req.deletePhotoIds() != null && !req.deletePhotoIds().isEmpty()) {
            for (UUID pid : req.deletePhotoIds()) {
                photoService.delete(brandId, productId, pid);
            }
        }
        if (newPhotos != null && !newPhotos.isEmpty()) {
            photoService.addPhotos(brandId, productId, newPhotos);
        }
        if (req.setPrimaryPhotoId() != null) {
            photoService.setPrimary(brandId, productId, req.setPrimaryPhotoId());
        }
        if (req.reorderPhotoIds() != null && !req.reorderPhotoIds().isEmpty()) {
            photoService.reorderExact(brandId, productId, req.reorderPhotoIds());
        }

        existing = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Product reload failed"));

        return toResponse(existing);
    }

    @Transactional
    public void softDelete(UUID brandId, UUID productId) {
        Product existing = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Product not found"));
        if (!existing.getBrand().getId().equals(brandId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Brand mismatch");
        }
        existing.setDeleted(true);
        productRepository.save(existing);
    }

    @Transactional
    public List<ProductResponse> listByBrand(UUID brandId) {
        List<Product> items = productRepository.findAllByBrandIdAndDeletedFalse(brandId);
        return items.stream().map(this::toResponse).toList();
    }

    @Transactional
    public List<ProductResponse> search(String query, String category, String minPrice, String maxPrice,
                                        int page, int size) {

        ProductCategory cat = null;
        if (category != null && !category.isBlank()) {
            try { cat = ProductCategory.valueOf(category.trim().toUpperCase()); } catch (IllegalArgumentException ignored) {}
        }

        BigDecimal min = null, max = null;
        try { if (minPrice != null && !minPrice.isBlank()) min = new BigDecimal(minPrice.trim()); } catch (NumberFormatException ignored) {}
        try { if (maxPrice != null && !maxPrice.isBlank()) max = new BigDecimal(maxPrice.trim()); } catch (NumberFormatException ignored) {}

        Specification<Product> spec = Specification.allOf(
                notDeleted(),
                statusActive(),
                queryLike(query),
                categoryEq(cat),
                priceGte(min),
                priceLte(max)
        );

        Pageable pageable = PageRequest.of(
                Math.max(0, page),
                Math.max(1, size),
                Sort.by(Sort.Direction.DESC, "createdAt", "id") // stable paging
        );

        return productRepository.findAll(spec, pageable)
                .stream()
                .map(this::toResponse)
                .toList();
    }
    public ProductResponse getPublicById(UUID id) {
        Product p = productRepository.findById(id)
                .filter(prod -> !prod.isDeleted() && prod.getStatus() == ProductStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Product not found"));
        return toResponse(p); // <-- use the local mapper
    }

    public ProductResponse getPublicBySlug(String slug) {
        Product p = productRepository.findBySlugIgnoreCase(slug)
                .filter(prod -> !prod.isDeleted() && prod.getStatus() == ProductStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Product not found"));
        return toResponse(p); // <-- use the local mapper
    }
    @jakarta.transaction.Transactional
    public ProductResponse getRandomPublicProductWithSpecs() {
        // pool = ACTIVE + not-deleted
        Specification<Product> spec = Specification.allOf(
                notDeleted(),
                statusActive()
        );

        // You can sort however you want; sort doesn’t matter since we’ll pick a random index
        List<Product> pool = productRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"));
        if (pool.isEmpty()) {
            throw new ResponseStatusException(NOT_FOUND, "No products available");
        }

        Product picked = pool.get(ThreadLocalRandom.current().nextInt(pool.size()));
        return toResponse(picked);
    }

    @jakarta.transaction.Transactional
    public List<ProductResponse> getRandomPublicProductsWithSpecs(int count) {
        int n = count <= 0 ? 5 : count;

        Specification<Product> spec = Specification.allOf(
                notDeleted(),
                statusActive()
        );

        List<Product> pool = productRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"));
        if (pool.isEmpty()) {
            return List.of();
        }

        // Shuffle the pool and take first n (unique) items
        Collections.shuffle(pool);
        return pool.stream()
                .limit(n)
                .map(this::toResponse)
                .toList();
    }
}
