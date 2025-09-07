package com.spark.electronics_store.controller;

import com.spark.electronics_store.dto.BrandSummaryResponse;
import com.spark.electronics_store.model.Role;
import com.spark.electronics_store.service.UserSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

// e.g., in a new controller or alongside existing public-facing endpoints
@RestController
@RequestMapping("/public/users")
@RequiredArgsConstructor
public class PublicUserSyncController {

    private final UserSyncService userSyncService;

    @GetMapping("/{id}/brand")
    public ResponseEntity<BrandSummaryResponse> getBrandForUser(@PathVariable UUID id) {
        var optUser = userSyncService.getWithBrand(id);
        if (optUser.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        var userSync = optUser.get();
        if (userSync.isDeleted() || userSync.getRole() != Role.BRAND_SELLER) {
            return ResponseEntity.notFound().build();
        }

        var brand = userSync.getBrand();
        if (brand == null) {
            // No brand assigned: could return 204 or OK with null body. Here we choose 204.
            return ResponseEntity.status(204).build();
        }

        BrandSummaryResponse resp = BrandSummaryResponse.builder()
                .id(brand.getId())
                .name(brand.getName())
                .slug(brand.getSlug())
                .logoUrl(brand.getLogoUrl())
                .build();
        return ResponseEntity.ok(resp);
    }

}
