// src/main/java/com/spark/electronics_store/controller/PublicProductController.java
package com.spark.electronics_store.controller;

import com.spark.electronics_store.dto.ProductResponse;
import com.spark.electronics_store.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/products")
@RequiredArgsConstructor
public class PublicProductController {

    private final ProductService productService;

    @GetMapping("/search")
    public List<ProductResponse> search(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String minPrice,
            @RequestParam(required = false) String maxPrice,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return productService.search(query, category, minPrice, maxPrice, page, size);
    }

    // Public details by UUID
    @GetMapping("/{id}")
    public ProductResponse getById(@PathVariable UUID id) {
        return productService.getPublicById(id);
    }

    // Public details by slug
    @GetMapping("/slug/{slug}")
    public ProductResponse getBySlug(@PathVariable String slug) {
        return productService.getPublicBySlug(slug);
    }

    /** NEW: One random product (with specs) */
    @GetMapping("/random")
    public ProductResponse getRandomProductWithSpecs() {
        return productService.getRandomPublicProductWithSpecs();
    }

    /** NEW: Five random products (with specs) */
    @GetMapping("/random5")
    public List<ProductResponse> getFiveRandomProductsWithSpecs() {
        return productService.getRandomPublicProductsWithSpecs(5);
    }
}
