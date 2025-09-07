package com.spark.electronics_store.service;

import com.spark.electronics_store.dto.UserSyncDto;
import com.spark.electronics_store.model.Brand;
import com.spark.electronics_store.model.Role;
import com.spark.electronics_store.model.UserSync;
import com.spark.electronics_store.repository.BrandRepository;
import com.spark.electronics_store.repository.UserSyncRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class UserSyncService {

    private final UserSyncRepository repository;
    private final BrandRepository brandRepository;

    // <slug>-seller@noreply.local
    private static final Pattern SELLER_EMAIL_PATTERN =
            Pattern.compile("^([a-z0-9][a-z0-9-]*)-seller@noreply\\.local$", Pattern.CASE_INSENSITIVE);

    /**
     * Upsert the user record coming from the user-management service.
     *
     * Rules:
     *  - Creates the user if missing; otherwise updates fields.
     *  - If "role" is present, it sets/overwrites role.
     *  - If "brandId" is present (not null), it attaches the brand to the user (replaces existing).
     *    The user will end up with at most one brand.
     *  - NEW: If the user has BRAND_SELLER role and no brand yet, auto-attach a brand inferred
     *    from email pattern "<slug>-seller@noreply.local". Creates the brand if missing.
     *  - Honors "deleted" and "tokenVersion" fields when provided.
     *  - Keeps invariant: if a user has a brand, role is coerced to BRAND_SELLER.
     */
    @Transactional
    public void upsert(UserSyncDto dto) {
        if (dto == null || dto.id() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing user id");
        }

        UserSync u = repository.findById(dto.id())
                .orElse(UserSync.builder().id(dto.id()).build());

        // Basic fields
        if (dto.email() != null) u.setEmail(dto.email());
        if (dto.name() != null)  u.setName(dto.name());

        // Role handling (optional)
        if (dto.role() != null) {
            try {
                u.setRole(Role.valueOf(dto.role()));
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role: " + dto.role());
            }
        }

        // Token version / deletion flags (optional)
        if (dto.tokenVersion() != null) {
            u.setTokenVersion(dto.tokenVersion());
        }
        if (dto.deleted() != null) {
            u.setDeleted(dto.deleted());
        }

        // Brand attach (explicit from DTO)
        if (dto.brandId() != null) {
            attachOrReplaceBrand(u, dto.brandId());
        }

        // Auto-attach brand if this is a BRAND_SELLER without a brand, inferring from email
        if (u.getBrand() == null && u.getRole() == Role.BRAND_SELLER) {
            maybeAttachBrandFromEmail(u);
        }

        // Keep invariant: if user has a brand, ensure role is BRAND_SELLER
        if (u.getBrand() != null && u.getRole() != Role.BRAND_SELLER) {
            u.setRole(Role.BRAND_SELLER);
        }

        repository.save(u);
    }

    /**
     * Assign a brand to a user (replaces any previous brand).
     * Enforces: max 1 brand per user; coerces role to BRAND_SELLER.
     */
    @Transactional
    public void assignBrand(UUID userId, UUID brandId) {
        UserSync u = repository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        assertNotDeleted(u);

        attachOrReplaceBrand(u, brandId);

        if (u.getRole() != Role.BRAND_SELLER) {
            u.setRole(Role.BRAND_SELLER);
        }

        repository.save(u);
    }

    /**
     * Detach any brand from a user.
     * If you want auto-demote from BRAND_SELLER to USER, uncomment the marked block.
     */
    @Transactional
    public void detachBrand(UUID userId) {
        UserSync u = repository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        assertNotDeleted(u);

        u.setBrand(null);

        // Optional auto-demotion:
        // if (u.getRole() == Role.BRAND_SELLER) {
        //     u.setRole(Role.USER);
        // }

        repository.save(u);
    }

    /**
     * Explicit role change with guard: cannot set a non-seller role while user has a brand.
     */
    @Transactional
    public void setRole(UUID userId, Role role) {
        UserSync u = repository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        assertNotDeleted(u);

        if (u.getBrand() != null && role != Role.BRAND_SELLER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot set role to " + role + " while user is associated to a brand");
        }

        u.setRole(role);
        repository.save(u);
    }

    /**
     * Retrieve with brand eager-loaded if your repo supports it.
     */
    @Transactional(readOnly = true)
    public Optional<UserSync> getWithBrand(UUID id) {
        return repository.findWithBrandById(id);
    }

    /**
     * Soft-delete user.
     */
    @Transactional
    public void markDeleted(UUID id) {
        repository.findById(id).ifPresent(u -> {
            u.setDeleted(true);
            repository.save(u);
        });
    }

    /**
     * Basic getter.
     */
    @Transactional(readOnly = true)
    public Optional<UserSync> get(UUID id) {
        return repository.findById(id);
    }

    // ----------------------- internal helpers -----------------------

    private void attachOrReplaceBrand(UserSync user, UUID brandId) {
        if (brandId == null) return;
        Brand brand = brandRepository.findById(brandId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Brand not found"));
        if (user.getBrand() != null && Objects.equals(user.getBrand().getId(), brand.getId())) {
            return; // no-op
        }
        user.setBrand(brand);
    }

    private void maybeAttachBrandFromEmail(UserSync user) {
        String email = Optional.ofNullable(user.getEmail()).orElse("").toLowerCase(Locale.ROOT);
        Matcher m = SELLER_EMAIL_PATTERN.matcher(email);
        if (!m.matches()) return;

        String slug = m.group(1); // the brand slug
        Brand brand = brandRepository.findBySlug(slug).orElseGet(() -> {
            Brand b = new Brand();
            b.setSlug(slug);
            b.setName(capitalizeWords(slug.replace('-', ' ')));
            return brandRepository.save(b);
        });

        user.setBrand(brand);
    }

    private void assertNotDeleted(UserSync user) {
        if (user.isDeleted()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is deleted");
        }
    }

    private static String capitalizeWords(String s) {
        String[] parts = (s == null ? "" : s).trim().split("\\s+");
        StringBuilder out = new StringBuilder();
        for (String p : parts) {
            if (p.isBlank()) continue;
            out.append(Character.toUpperCase(p.charAt(0)))
                    .append(p.length() > 1 ? p.substring(1) : "")
                    .append(' ');
        }
        return out.toString().trim();
    }
}
