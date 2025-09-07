package com.spark.electronics_store.controller;

import com.spark.electronics_store.dto.UserSyncDto;
import com.spark.electronics_store.dto.UserSyncWithBrandResponse;
import com.spark.electronics_store.service.UserSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/internal/sync/users")
@RequiredArgsConstructor
public class UserSyncController {

    private final UserSyncService userSyncService;

    // Hardcoded internal secret (must match what user-management sends)
    private static final String SHARED_SECRET = "moldo";

    private boolean authorized(String header) {
        if (header == null) return false;
        String token = header.trim();
        if (token.toLowerCase().startsWith("bearer ")) {
            token = token.substring(7).trim();
        }
        return SHARED_SECRET.equals(token);
    }

    @PostMapping
    public ResponseEntity<Void> upsert(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @RequestBody UserSyncDto dto) {

        if (!authorized(auth)) {
            return ResponseEntity.status(401).build();
        }

        userSyncService.upsert(dto);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable UUID id) {

        if (!authorized(auth)) {
            return ResponseEntity.status(401).build();
        }

        userSyncService.markDeleted(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserSyncWithBrandResponse> get(
            @RequestHeader(value = "Authorization", required = false) String auth,
            @PathVariable UUID id) {

        if (!authorized(auth)) {
            return ResponseEntity.status(401).build();
        }

        // Use eager-with-brand variant to avoid lazy-loading issues in the mapper
        return userSyncService.getWithBrand(id)
                .map(u -> ResponseEntity.ok(UserSyncWithBrandResponse.from(u)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
