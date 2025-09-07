package com.spark.electronics_store.security;

import com.spark.electronics_store.model.Role;
import com.spark.electronics_store.model.UserSync;
import com.spark.electronics_store.repository.UserSyncRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class BrandAuthorizationService {

    private final UserSyncRepository userSyncRepository;

    /**
     * Resolve the current synced user by Authentication principal name (email).
     * Throws AccessDenied if unauthenticated or not found.
     */
    public UserSync requireUserSync(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new AccessDeniedException("Unauthenticated");
        }
        String email = authentication.getName().toLowerCase();
        return userSyncRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new AccessDeniedException("Synced user not found"));
    }

    /**
     * Quick boolean check used by controllers that need a non-throwing admin test.
     */
    public boolean isAdmin(Authentication authentication) {
        try {
            UserSync u = requireUserSync(authentication);
            return !u.isDeleted() && u.getRole() == Role.ADMIN;
        } catch (Exception ex) {
            return false;
        }
    }

    /**
     * Enforce that current user is ADMIN.
     */
    public void requireAdmin(Authentication authentication) {
        UserSync user = requireUserSync(authentication);
        if (user.isDeleted() || user.getRole() != Role.ADMIN) {
            throw new AccessDeniedException("Only admins can perform this action");
        }
    }

    /**
     * Enforce that current user is a BRAND_SELLER assigned to a specific brand.
     */
    public void requireBrandSellerForBrand(UUID brandId, Authentication authentication) {
        UserSync user = requireUserSync(authentication);
        if (user.isDeleted()) {
            throw new AccessDeniedException("User deleted");
        }
        if (user.getRole() != Role.BRAND_SELLER) {
            throw new AccessDeniedException("Only brand sellers can operate on products");
        }
        if (user.getBrand() == null || !user.getBrand().getId().equals(brandId)) {
            throw new AccessDeniedException("Brand seller not assigned to this brand");
        }
    }

    /**
     * Optional relaxed check: allow ADMIN or assigned BRAND_SELLER.
     */
    public void authorizeBrandAccess(UUID brandId, Authentication authentication) {
        UserSync user = requireUserSync(authentication);
        if (user.isDeleted()) throw new AccessDeniedException("User deleted");

        if (user.getRole() == Role.ADMIN) return;

        if (user.getRole() == Role.BRAND_SELLER
                && user.getBrand() != null
                && brandId != null
                && brandId.equals(user.getBrand().getId())) {
            return;
        }
        throw new AccessDeniedException("Not authorized for brand");
    }
}
