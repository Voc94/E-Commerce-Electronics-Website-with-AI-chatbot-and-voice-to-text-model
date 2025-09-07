package com.spark.electronics_store.dto;

import java.util.UUID;

public record ProductPhotoResponse(
        UUID id,
        String filename,
        String contentType,
        int position,
        boolean primary,
        String url // served by /brands/{brandId}/products/{productId}/photos/{photoId}
) {}
