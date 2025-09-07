package com.spark.electronics_store.dto;

import com.spark.electronics_store.model.ProductCategory;
import com.spark.electronics_store.model.ProductStatus;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record ProductResponse(
        UUID id,
        String name,
        String slug,
        String description,
        BigDecimal price,
        String currency,
        ProductCategory category,
        ProductStatus status,
        List<ProductPhotoResponse> photos
) {}
