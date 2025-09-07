package com.spark.electronics_store.service;

import com.spark.electronics_store.model.Brand;
import com.spark.electronics_store.model.Role;
import com.spark.electronics_store.model.UserSync;
import com.spark.electronics_store.repository.BrandRepository;
import com.spark.electronics_store.repository.UserSyncRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.springframework.http.HttpStatus.*;

@Service
@RequiredArgsConstructor
public class BrandService {
    private final BrandRepository brandRepository;
    private final UserSyncRepository userSyncRepository;

    @Transactional
    public Brand createBrand(String name, String slug, String logoUrl) {
        Brand brand = Brand.builder()
                .name(name)
                .slug(slug)
                .logoUrl(logoUrl)
                .build(); // no .id(...) here
        return brandRepository.saveAndFlush(brand);
    }


    public void assignSellerToBrand(UUID userSyncId, UUID brandId) {
        UserSync user = userSyncRepository.findById(userSyncId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "UserSync not found"));
        if (user.isDeleted() || user.getRole() != Role.BRAND_SELLER) {
            throw new ResponseStatusException(BAD_REQUEST, "User is not an active brand seller");
        }
        Brand brand = brandRepository.findById(brandId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Brand not found"));
        user.setBrand(brand);
        userSyncRepository.save(user);
    }
}
