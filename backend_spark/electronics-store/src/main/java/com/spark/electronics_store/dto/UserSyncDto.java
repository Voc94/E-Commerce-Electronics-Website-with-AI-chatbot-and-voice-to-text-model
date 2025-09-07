package com.spark.electronics_store.dto;

import java.util.UUID;

// example shape, adjust if needed
public record UserSyncDto(
        UUID id,
        String name,
        String email,
        String role,         // "USER", "ADMIN", "BRAND_SELLER", ...
        Integer tokenVersion,
        Boolean deleted,
        UUID brandId         // optional – attach/replace if present
) {}
