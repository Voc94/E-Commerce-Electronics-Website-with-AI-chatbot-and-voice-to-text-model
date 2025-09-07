package com.spark.electronics_store.controller;

import com.spark.electronics_store.dto.BrandRequestCreateDto;
import com.spark.electronics_store.dto.BrandRequestResponse;
import com.spark.electronics_store.dto.RejectBrandRequestDto;
import com.spark.electronics_store.model.*;
import com.spark.electronics_store.repository.BrandRepository;
import com.spark.electronics_store.repository.UserSyncRepository;
import com.spark.electronics_store.security.BrandAuthorizationService;
import com.spark.electronics_store.service.BrandRequestService;
import com.spark.electronics_store.service.BrandService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import jakarta.validation.Valid;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.*;

@CrossOrigin(
        origins = {"http://localhost:3000", "http://localhost:5173"},
        allowCredentials = "true",
        allowedHeaders = {"Authorization", "Content-Type"},
        methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS}
)
@RestController
@RequestMapping("/brands")
@RequiredArgsConstructor
public class BrandController {

    private final BrandService brandService;
    private final BrandAuthorizationService authService;
    private final BrandRepository brandRepository;
    private final UserSyncRepository userSyncRepository;
    private final BrandRequestService brandRequestService;

    // ========== Brands ==========

    @PostMapping
    public ResponseEntity<Brand> createBrand(@RequestBody @Valid BrandRequestCreateDto req,
                                             Authentication authentication) {
        authService.requireAdmin(authentication);
        Brand brand = brandService.createBrand(req.getName(), req.getSlug(), req.getLogoUrl());
        return ResponseEntity.status(201).body(brand);
    }

    @PostMapping("/{brandId}/assign-seller/{userId}")
    public ResponseEntity<Void> assignSeller(@PathVariable UUID brandId,
                                             @PathVariable UUID userId,
                                             Authentication authentication) {
        authService.requireAdmin(authentication);

        Brand brand = brandRepository.findById(brandId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Brand not found"));
        UserSync seller = userSyncRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "UserSync not found"));

        if (seller.isDeleted() || seller.getRole() != Role.BRAND_SELLER) {
            throw new ResponseStatusException(BAD_REQUEST, "User is not an active brand seller");
        }

        seller.setBrand(brand);
        userSyncRepository.save(seller);
        return ResponseEntity.ok().build();
    }

    @GetMapping
    public ResponseEntity<List<Brand>> listBrands(@RequestParam(value = "q", required = false) String q,
                                                  Authentication authentication) {
        List<Brand> brands;
        if (q == null || q.isBlank()) {
            brands = brandRepository.findAll();
        } else {
            brands = brandRepository.findByNameContainingIgnoreCaseOrSlugContainingIgnoreCase(q, q);
        }
        return ResponseEntity.ok(brands);
    }

    // ========== Brand Requests ==========

    @PostMapping("/requests")
    public ResponseEntity<BrandRequestResponse> submitRequest(
            @RequestBody @Valid BrandRequestCreateDto dto,
            Authentication authentication) {

        if (!(authentication instanceof JwtAuthenticationToken jwtAuth)) {
            throw new ResponseStatusException(UNAUTHORIZED, "Invalid authentication type");
        }

        Jwt jwt = jwtAuth.getToken();
        String idString = jwt.getClaimAsString("id");
        if (idString == null) throw new ResponseStatusException(BAD_REQUEST, "Missing 'id' claim");
        UUID applicantId = UUID.fromString(idString);

        BrandRequest created = brandRequestService.submitRequest(dto, applicantId);
        return ResponseEntity.status(201).body(BrandRequestResponse.from(created));
    }

    @GetMapping("/requests")
    public ResponseEntity<List<BrandRequestResponse>> listRequests(
            @RequestParam(value = "status", required = false) String status,
            Authentication authentication) {
        authService.requireAdmin(authentication);
        Optional<BrandRequestStatus> maybe = Optional.empty();
        if (status != null && !status.isBlank()) {
            try {
                maybe = Optional.of(BrandRequestStatus.valueOf(status.toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(BAD_REQUEST, "Invalid status");
            }
        }
        List<BrandRequestResponse> resp = brandRequestService.list(maybe)
                .stream()
                .map(BrandRequestResponse::from)
                .collect(Collectors.toList());
        return ResponseEntity.ok(resp);
    }

    @PutMapping("/requests/{id}/approve")
    public ResponseEntity<BrandRequestResponse> approveRequest(
            @PathVariable UUID id,
            Authentication authentication) {
        authService.requireAdmin(authentication);
        String adminId = (authentication != null ? authentication.getName() : "unknown");
        BrandRequest approved = brandRequestService.approve(id, adminId);
        return ResponseEntity.ok(BrandRequestResponse.from(approved));
    }

    @PutMapping("/requests/{id}/reject")
    public ResponseEntity<BrandRequestResponse> rejectRequest(
            @PathVariable UUID id,
            @RequestBody RejectBrandRequestDto dto,
            Authentication authentication) {
        authService.requireAdmin(authentication);
        String adminId = (authentication != null ? authentication.getName() : "unknown");
        BrandRequest rejected = brandRequestService.reject(id, dto.getReason(), adminId);
        return ResponseEntity.ok(BrandRequestResponse.from(rejected));
    }

    @GetMapping("/requests/mine")
    public ResponseEntity<BrandRequestResponse> getMyRequest(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwtAuth)) {
            throw new ResponseStatusException(UNAUTHORIZED, "Invalid authentication type");
        }
        Jwt jwt = jwtAuth.getToken();
        String idString = jwt.getClaimAsString("id");
        if (idString == null) throw new ResponseStatusException(BAD_REQUEST, "Missing 'id' claim");
        UUID applicantId = UUID.fromString(idString);

        return brandRequestService.findMine(applicantId)
                .map(BrandRequestResponse::from)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(NOT_FOUND).build());
    }

    // ========== Logo upload/serve (fixes your 404) ==========

    @PostMapping(value = "/requests/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Void> uploadRequestLogo(
            @PathVariable UUID id,
            @RequestPart("file") MultipartFile file,
            Authentication authentication) {

        UUID actorId = null;
        boolean isAdmin = false;

        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            Jwt jwt = jwtAuth.getToken();
            String idString = jwt.getClaimAsString("id");
            if (idString != null) {
                try { actorId = UUID.fromString(idString); } catch (IllegalArgumentException ignored) {}
            }
            // if your BrandAuthorizationService doesn't have isAdmin, you can just rely on service-level checks
            try { isAdmin = authService.isAdmin(authentication); } catch (Throwable ignored) { isAdmin = false; }
        }

        if (actorId == null && !isAdmin) {
            throw new ResponseStatusException(UNAUTHORIZED, "Unauthenticated");
        }

        brandRequestService.attachLogo(id, file, actorId, isAdmin);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/requests/{id}/logo")
    public ResponseEntity<byte[]> getRequestLogo(@PathVariable UUID id) {
        var stored = brandRequestService.getLogo(id);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(stored.contentType));
        headers.setCacheControl(CacheControl.noCache());
        return new ResponseEntity<>(stored.bytes, headers, OK);
    }
    @DeleteMapping("/{brandId}/assign-seller/{userId}")
    public ResponseEntity<Void> clearSellerBrand(@PathVariable UUID brandId,
                                                 @PathVariable UUID userId,
                                                 Authentication auth) {
        authService.requireAdmin(auth);
        var user = userSyncRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "UserSync not found"));
        if (user.getBrand() == null || !user.getBrand().getId().equals(brandId)) {
            throw new ResponseStatusException(BAD_REQUEST, "Brand mismatch or no brand assigned");
        }
        user.setBrand(null);
        userSyncRepository.save(user);
        return ResponseEntity.noContent().build();
    }
    // in BrandController
    @GetMapping("/slug/{slug}")
    public ResponseEntity<Brand> getBySlug(@PathVariable String slug) {
        return brandRepository.findBySlug(slug)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

}
