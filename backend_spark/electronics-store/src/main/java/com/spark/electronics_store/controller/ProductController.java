package com.spark.electronics_store.controller;

import com.spark.electronics_store.dto.CreateProductRequest;
import com.spark.electronics_store.dto.ProductPhotoResponse;
import com.spark.electronics_store.dto.ProductResponse;
import com.spark.electronics_store.dto.ReorderPhotosRequest;
import com.spark.electronics_store.dto.UpdateProductRequest;
import com.spark.electronics_store.model.ProductPhoto;
import com.spark.electronics_store.security.BrandAuthorizationService;
import com.spark.electronics_store.service.ProductPhotoService;
import com.spark.electronics_store.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/brands/{brandId}/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;
    private final ProductPhotoService photoService;
    private final BrandAuthorizationService authService;

    // -------- products --------
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProductResponse> create(@PathVariable UUID brandId,
                                                  @RequestPart("product") CreateProductRequest req,
                                                  @RequestPart(value = "photos", required = false) MultipartFile[] photos,
                                                  Authentication auth) {
        authService.requireBrandSellerForBrand(brandId, auth);
        ProductResponse created = productService.create(brandId, req, photos);
        return ResponseEntity.status(201).body(created);
    }

    @PutMapping(value = "/{productId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProductResponse> update(@PathVariable UUID brandId,
                                                  @PathVariable UUID productId,
                                                  @RequestPart("product") UpdateProductRequest req,
                                                  @RequestPart(value = "newPhotos", required = false) List<MultipartFile> newPhotos,
                                                  Authentication auth) {
        authService.requireBrandSellerForBrand(brandId, auth);
        ProductResponse updated = productService.update(brandId, productId, req, newPhotos);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{productId}")
    public ResponseEntity<Void> delete(@PathVariable UUID brandId,
                                       @PathVariable UUID productId,
                                       Authentication auth) {
        authService.requireBrandSellerForBrand(brandId, auth);
        productService.softDelete(brandId, productId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<ProductResponse>> list(@PathVariable UUID brandId) {
        return ResponseEntity.ok(productService.listByBrand(brandId));
    }

    // -------- photos (same controller) --------
    @PostMapping(value = "/{productId}/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProductPhotoResponse> uploadPhoto(@PathVariable UUID brandId,
                                                            @PathVariable UUID productId,
                                                            @RequestPart("file") MultipartFile file,
                                                            Authentication auth) {
        authService.requireBrandSellerForBrand(brandId, auth);
        ProductPhotoResponse photo = photoService.upload(brandId, productId, file);
        return ResponseEntity.status(201).body(photo);
    }

    @GetMapping("/{productId}/photos")
    public ResponseEntity<List<ProductPhotoResponse>> listPhotos(@PathVariable UUID brandId,
                                                                 @PathVariable UUID productId,
                                                                 Authentication auth) {
        authService.requireBrandSellerForBrand(brandId, auth);
        return ResponseEntity.ok(photoService.list(brandId, productId));
    }
    // Publicly serve photo bytes so frontend <img> can load them directly
    @GetMapping({"/{productId}/photos/{photoId}", "/{productId}/photos/{photoId}/raw"})
    public ResponseEntity<byte[]> getPhotoBytes(@PathVariable UUID brandId,
                                                @PathVariable UUID productId,
                                                @PathVariable UUID photoId) {
        // ⚠️ No auth check here – safe read-only
        ProductPhoto photo = photoService.getEntity(brandId, productId, photoId);

        // fallback content type if DB has null/invalid
        String contentType = photo.getContentType();
        if (contentType == null || contentType.isBlank() || contentType.equals("application/octet-stream")) {
            contentType = "image/jpeg"; // default safe fallback
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + photo.getFilename() + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(photo.getData());
    }


    @DeleteMapping("/{productId}/photos/{photoId}")
    public ResponseEntity<Void> deletePhoto(@PathVariable UUID brandId,
                                            @PathVariable UUID productId,
                                            @PathVariable UUID photoId,
                                            Authentication auth) {
        authService.requireBrandSellerForBrand(brandId, auth);
        photoService.delete(brandId, productId, photoId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{productId}/photos/{photoId}/primary")
    public ResponseEntity<Void> setPrimary(@PathVariable UUID brandId,
                                           @PathVariable UUID productId,
                                           @PathVariable UUID photoId,
                                           Authentication auth) {
        authService.requireBrandSellerForBrand(brandId, auth);
        photoService.setPrimary(brandId, productId, photoId);
        return ResponseEntity.ok().build();
    }

    @PutMapping("/{productId}/photos/order")
    public ResponseEntity<Void> reorder(@PathVariable UUID brandId,
                                        @PathVariable UUID productId,
                                        @RequestBody ReorderPhotosRequest req,
                                        Authentication auth) {
        authService.requireBrandSellerForBrand(brandId, auth);
        photoService.reorderExact(brandId, productId, req.photoIds());
        return ResponseEntity.ok().build();
    }
}
