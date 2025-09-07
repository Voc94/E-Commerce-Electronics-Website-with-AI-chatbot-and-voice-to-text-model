package com.spark.electronics_store.dto;

import com.spark.electronics_store.model.Role;
import com.spark.electronics_store.model.UserSync;

import java.util.UUID;

public record UserSyncWithBrandResponse(
        UUID id,
        String email,
        String name,
        Role role,
        int tokenVersion,
        boolean deleted,
        BrandSummaryResponse brand
) {
    public static UserSyncWithBrandResponse from(UserSync u) {
        BrandSummaryResponse bs = null;
        if (u.getBrand() != null) {
            bs = new BrandSummaryResponse(
                    u.getBrand().getId(),
                    u.getBrand().getName(),
                    u.getBrand().getSlug(),
                    u.getBrand().getLogoUrl()
            );
        }
        return new UserSyncWithBrandResponse(
                u.getId(),
                u.getEmail(),
                u.getName(),
                u.getRole(),
                u.getTokenVersion(),
                u.isDeleted(),
                bs
        );
    }
}