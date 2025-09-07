package com.spark.electronics_store.service;

import com.spark.electronics_store.dto.ProductPhotoResponse;
import com.spark.electronics_store.model.Brand;
import com.spark.electronics_store.model.Product;
import com.spark.electronics_store.model.ProductPhoto;
import com.spark.electronics_store.repository.BrandRepository;
import com.spark.electronics_store.repository.ProductPhotoRepository;
import com.spark.electronics_store.repository.ProductRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductPhotoService {

    private final BrandRepository brandRepository;
    private final ProductRepository productRepository;
    private final ProductPhotoRepository photoRepository;

    // ---- helpers ----
    private Product resolveProduct(UUID brandId, UUID productId) {
        Brand brand = brandRepository.findById(brandId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Brand not found"));
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
        if (!product.getBrand().getId().equals(brand.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Product does not belong to brand");
        }
        return product;
    }

    private String photoUrl(UUID brandId, UUID productId, UUID photoId) {
        // Controller serves bytes at /brands/{brandId}/products/{productId}/photos/{photoId}
        return String.format("/brands/%s/products/%s/photos/%s", brandId, productId, photoId);
    }

    private ProductPhotoResponse toDto(ProductPhoto p, UUID brandId, UUID productId) {
        return new ProductPhotoResponse(
                p.getId(),
                p.getFilename(),
                p.getContentType(),
                Optional.ofNullable(p.getPosition()).orElse(0),
                p.isPrimary(),
                photoUrl(brandId, productId, p.getId())
        );
    }

    // ---- API used by controller ----
    @Transactional
    public ProductPhotoResponse upload(UUID brandId, UUID productId, MultipartFile file) {
        Product product = resolveProduct(brandId, productId);

        int nextPos = photoRepository.countByProduct_Id(productId);
        try {
            // ✅ Detect content type properly
            String contentType = file.getContentType();
            if (contentType == null || contentType.isBlank() || contentType.equals("application/octet-stream")) {
                String filename = file.getOriginalFilename();
                if (filename != null) {
                    String lower = filename.toLowerCase();
                    if (lower.endsWith(".png")) {
                        contentType = "image/png";
                    } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
                        contentType = "image/jpeg";
                    } else if (lower.endsWith(".gif")) {
                        contentType = "image/gif";
                    } else {
                        contentType = "image/png"; // default safe fallback
                    }
                } else {
                    contentType = "image/png"; // fallback if no filename
                }
            }

            ProductPhoto entity = ProductPhoto.builder()
                    .id(UUID.randomUUID())
                    .product(product)
                    .filename(Objects.requireNonNullElse(file.getOriginalFilename(), "upload"))
                    .contentType(contentType)        // ✅ correct MIME type
                    .data(file.getBytes())           // ✅ real image bytes
                    .position(nextPos)
                    .primary(nextPos == 0)
                    .build();

            ProductPhoto saved = photoRepository.save(entity);
            return toDto(saved, brandId, productId);

        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unable to read uploaded file", e);
        }
    }


    @Transactional
    public List<ProductPhotoResponse> list(UUID brandId, UUID productId) {
        resolveProduct(brandId, productId);
        return photoRepository.findByProduct_IdOrderByPositionAsc(productId)
                .stream()
                .map(p -> toDto(p, brandId, productId))
                .collect(Collectors.toList());
    }

    @Transactional
    public ProductPhoto getEntity(UUID brandId, UUID productId, UUID photoId) {
        Product product = resolveProduct(brandId, productId);
        ProductPhoto photo = photoRepository.findById(photoId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Photo not found"));
        if (!photo.getProduct().getId().equals(product.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Photo does not belong to product");
        }
        return photo;
    }

    @Transactional
    public void delete(UUID brandId, UUID productId, UUID photoId) {
        ProductPhoto photo = getEntity(brandId, productId, photoId);
        photoRepository.delete(photo);

        // re-pack positions (optional)
        List<ProductPhoto> remaining = photoRepository.findByProduct_IdOrderByPositionAsc(productId);
        for (int i = 0; i < remaining.size(); i++) {
            remaining.get(i).setPosition(i);
        }
        photoRepository.saveAll(remaining);

        // ensure one primary remains (optional)
        if (remaining.stream().noneMatch(ProductPhoto::isPrimary) && !remaining.isEmpty()) {
            remaining.get(0).setPrimary(true);
            photoRepository.save(remaining.get(0));
        }
    }

    @Transactional
    public void setPrimary(UUID brandId, UUID productId, UUID photoId) {
        ProductPhoto target = getEntity(brandId, productId, photoId);
        List<ProductPhoto> all = photoRepository.findByProduct_IdOrderByPositionAsc(productId);
        for (ProductPhoto p : all) {
            p.setPrimary(p.getId().equals(target.getId()));
        }
        photoRepository.saveAll(all);
    }

    @Transactional
    public void reorderExact(UUID brandId, UUID productId, List<UUID> orderedIds) {
        List<ProductPhoto> all = photoRepository.findByProduct_IdOrderByPositionAsc(productId);

        if (orderedIds == null || orderedIds.size() != all.size()
                || !new HashSet<>(orderedIds).equals(all.stream().map(ProductPhoto::getId).collect(Collectors.toSet()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reorder list must contain exactly all photo IDs");
        }

        Map<UUID, ProductPhoto> byId = all.stream().collect(Collectors.toMap(ProductPhoto::getId, p -> p));
        for (int i = 0; i < orderedIds.size(); i++) {
            ProductPhoto p = byId.get(orderedIds.get(i));
            p.setPosition(i);
        }
        photoRepository.saveAll(all);
    }

    // used by ProductService when initially creating a product
    @Transactional
    public void addPhotos(UUID brandId, UUID productId, List<MultipartFile> files) {
        if (files == null) return;
        for (MultipartFile f : files) {
            upload(brandId, productId, f);
        }
    }
}
