package com.spark.demo.controller;

import com.spark.demo.dto.InternalUserSyncUpdate;
import com.spark.demo.model.Role;
import com.spark.demo.model.User;
import com.spark.demo.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/internal/sync")
@RequiredArgsConstructor
public class InternalSyncController {

    private final UserRepository userRepository;

    @Value("${sync.shared-secret}")
    private String sharedSecret;

    /** Expect Authorization: Bearer <sharedSecret> */
    private void requireInternalAuth(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing bearer");
        }
        String token = authHeader.substring("Bearer ".length()).trim();
        if (!sharedSecret.equals(token)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bad secret");
        }
    }

    /** Store service calls this when a brand request is approved to set role=BRAND_SELLER. */
    @PostMapping("/users")
    public ResponseEntity<Void> syncUserRole(
            @RequestBody InternalUserSyncUpdate dto,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        requireInternalAuth(authHeader);

        if (dto == null || dto.id() == null || dto.role() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "id and role are required");
        }

        UUID userId = UUID.fromString(dto.id());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Update role
        user.setRole(Role.valueOf(dto.role()));

        // NOTE: you don't have brand columns here; ignore brandId/brandSlug for now.
        // If you add them later, set them here.

        userRepository.save(user);

        // (Optional) If you later add token versioning to JWT validation,
        // you could bump a tokenVersion here and require refresh on client:
        // user.bumpTokenVersion(); userRepository.save(user);

        return ResponseEntity.noContent().build();
    }
}
