package com.spark.demo.dto;

public record InternalUserSyncUpdate(
        String id,          // UUID string
        String role,        // e.g. "BRAND_SELLER", "USER", "ADMIN"
        String brandId,     // optional future use
        String brandSlug    // optional future use
) {}
