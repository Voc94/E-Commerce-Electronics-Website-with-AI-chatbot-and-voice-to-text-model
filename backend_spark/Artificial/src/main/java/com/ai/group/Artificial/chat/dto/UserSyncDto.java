package com.ai.group.Artificial.chat.dto;

import java.util.UUID;

/**
 * Matches payload sent by user-management:
 * id, email, name, role (String), tokenVersion, delete (boolean)
 */
public record UserSyncDto(
        UUID id,
        String email,
        String name,
        String role,
        int tokenVersion,
        boolean delete
) { }
