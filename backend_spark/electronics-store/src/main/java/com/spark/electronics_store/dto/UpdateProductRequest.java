package com.spark.electronics_store.dto;

import com.spark.electronics_store.model.ProductCategory;
import com.spark.electronics_store.model.ProductStatus;

import java.util.List;
import java.util.UUID;

public record UpdateProductRequest(
        String name,
        String slug,
        String description,
        String price,
        String currency,
        ProductStatus status,
        ProductCategory category,

        // photo ops (all optional)
        List<UUID> deletePhotoIds,
        UUID setPrimaryPhotoId,
        List<UUID> reorderPhotoIds
) {}
