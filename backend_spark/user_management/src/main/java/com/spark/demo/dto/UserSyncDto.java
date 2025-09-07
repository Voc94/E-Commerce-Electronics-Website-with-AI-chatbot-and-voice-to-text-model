package com.spark.demo.dto;

import java.util.UUID;

public record UserSyncDto(
        UUID id,
        String email,
        String name,
        String role,
        int tokenVersion,
        boolean deleted
) { }
