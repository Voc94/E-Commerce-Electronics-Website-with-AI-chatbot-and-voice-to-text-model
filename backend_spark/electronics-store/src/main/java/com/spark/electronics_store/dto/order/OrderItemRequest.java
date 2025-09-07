package com.spark.electronics_store.dto.order;

import java.util.UUID;

public record OrderItemRequest(UUID productId, int qty) {}
