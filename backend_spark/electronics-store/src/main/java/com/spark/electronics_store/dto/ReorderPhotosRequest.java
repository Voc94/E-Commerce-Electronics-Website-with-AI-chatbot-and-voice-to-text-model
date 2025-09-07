package com.spark.electronics_store.dto;

import java.util.List;
import java.util.UUID;

public record ReorderPhotosRequest(List<UUID> photoIds) {}
