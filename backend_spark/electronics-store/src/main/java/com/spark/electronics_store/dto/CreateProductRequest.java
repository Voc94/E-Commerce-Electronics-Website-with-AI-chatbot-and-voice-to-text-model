package com.spark.electronics_store.dto;

import com.spark.electronics_store.model.ProductCategory;

public record CreateProductRequest(
        String name,
        String slug,
        String description,
        String price,     // string to avoid float surprises, parsed to BigDecimal
        String currency,
        ProductCategory category
) {}
