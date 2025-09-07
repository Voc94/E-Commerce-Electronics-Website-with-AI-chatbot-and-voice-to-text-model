package com.spark.electronics_store.service;

import com.spark.electronics_store.dto.BrandRequestCreateDto;
import com.spark.electronics_store.model.*;
import com.spark.electronics_store.repository.BrandRepository;
import com.spark.electronics_store.repository.BrandRequestRepository;
import com.spark.electronics_store.repository.UserSyncRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;   // <-- NEW
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;
import static org.springframework.http.HttpStatus.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class BrandRequestService {

    private final BrandRequestRepository brandRequestRepository;
    private final BrandRepository brandRepository;
    private final BrandService brandService;
    private final UserSyncRepository userSyncRepository;
    private final InMemoryLogoStore logoStore;

    private final RestTemplate restTemplate = new RestTemplate();

    @org.springframework.beans.factory.annotation.Value("${sync.user-base-url:http://localhost:8080}")
    private String userBaseUrl;

    @org.springframework.beans.factory.annotation.Value("${sync.shared-secret:moldo}")
    private String sharedSecret;

    /** Submit a request. */
    @Transactional
    public BrandRequest submitRequest(BrandRequestCreateDto dto, UUID applicantId) {
        if (dto == null || applicantId == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid request");
        }

        userSyncRepository.findById(applicantId).ifPresent(u -> {
            if (!u.isDeleted() && u.getBrand() != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User is already associated to a brand");
            }
        });

        long activeCount = brandRequestRepository.countByApplicantIdAndStatusNot(applicantId, BrandRequestStatus.REJECTED);
        if (activeCount > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You already have a request");
        }

        String name = dto.getName() == null ? "" : dto.getName().trim();
        String slug = dto.getSlug() == null ? "" : dto.getSlug().trim().toLowerCase();

        if (name.isBlank() || slug.isBlank()) {
            throw new ResponseStatusException(BAD_REQUEST, "Name/slug are required");
        }

        if (brandRepository.existsBySlugIgnoreCase(slug) || brandRepository.existsByNameIgnoreCase(name)) {
            throw new ResponseStatusException(CONFLICT, "Brand with that name or slug already exists");
        }

        BrandRequest req = new BrandRequest();
        req.setApplicantId(applicantId);
        req.setName(name);
        req.setSlug(slug);
        req.setLogoUrl(dto.getLogoUrl());
        req.setStatus(BrandRequestStatus.PENDING);
        req.setCreatedAt(LocalDateTime.now());

        return brandRequestRepository.saveAndFlush(req); // ensure row is written now
    }

    public List<BrandRequest> list(Optional<BrandRequestStatus> statusOpt) {
        if (statusOpt.isPresent()) return brandRequestRepository.findByStatus(statusOpt.get());
        return brandRequestRepository.findAll();
    }

    public Optional<BrandRequest> findMine(UUID applicantId) {
        return brandRequestRepository.findFirstByApplicantIdOrderByCreatedAtDesc(applicantId);
    }

    @Transactional
    public void attachLogo(UUID requestId, MultipartFile file, UUID actorId, boolean isAdmin) {
        BrandRequest br = brandRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Request not found"));

        if (!isAdmin && (actorId == null || !br.getApplicantId().equals(actorId))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed");
        }
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Empty file");
        }
        try {
            logoStore.put(requestId, file.getBytes(), file.getContentType());
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Could not read file");
        }
    }

    public InMemoryLogoStore.StoredLogo getLogo(UUID requestId) {
        brandRequestRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        return logoStore.get(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No logo"));
    }

    /** Approve → create Brand, assign user, sync role, set reviewedBy/approvedBrandId. */
    @Transactional
    public BrandRequest approve(UUID id, String adminId) {
        BrandRequest req = brandRequestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Request not found"));

        if (req.getStatus() != BrandRequestStatus.PENDING) {
            return req;
        }

        UserSync user = userSyncRepository.findById(req.getApplicantId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Applicant not found"));

        if (user.isDeleted()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Applicant is deleted");
        if (user.getBrand() != null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Applicant already has a brand");

        Brand brand = brandService.createBrand(req.getName(), req.getSlug(), req.getLogoUrl());

        user.setBrand(brand);
        user.setRole(Role.BRAND_SELLER);
        userSyncRepository.save(user);

        try {
            notifyUserManagementRole(user.getId(), Role.BRAND_SELLER.name());
        } catch (RestClientException ex) {
            log.warn("User-management sync failed for {}: {}", user.getId(), ex.toString());
        }

        req.setApprovedBrandId(brand.getId());
        req.setReviewedBy(adminId);
        req.setStatus(BrandRequestStatus.APPROVED);
        return brandRequestRepository.saveAndFlush(req);
    }

    @Transactional
    public BrandRequest reject(UUID id, String reason, String adminId) {
        BrandRequest req = brandRequestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Request not found"));

        if (req.getStatus() != BrandRequestStatus.PENDING) return req;

        req.setStatus(BrandRequestStatus.REJECTED);
        try { req.getClass().getMethod("setReason", String.class).invoke(req, reason); } catch (Exception ignored) {}
        req.setReviewedBy(adminId);
        return brandRequestRepository.saveAndFlush(req);
    }

    private void notifyUserManagementRole(UUID userId, String roleName) {
        String url = userBaseUrl.replaceAll("/$", "") + "/internal/sync/users";

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(sharedSecret);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of("id", userId.toString(), "role", roleName);

        restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Void.class);
        log.info("Synced role '{}' to user-management for user {}", roleName, userId);
    }

    /** Ensure there is an APPROVED record for this applicant+brand. */
    @Transactional
    public BrandRequest ensureApprovedRecordFor(UUID applicantId, Brand brand, String adminId) {
        var existingOpt = findMine(applicantId);
        if (existingOpt.isPresent()) {
            var br = existingOpt.get();
            if (br.getStatus() == BrandRequestStatus.APPROVED) return br;
            if (br.getStatus() == BrandRequestStatus.PENDING) {
                return approve(br.getId(), adminId);
            }
            br.setStatus(BrandRequestStatus.APPROVED);
            br.setReviewedBy(adminId);
            br.setApprovedBrandId(brand.getId());
            br.setName(brand.getName());
            br.setSlug(brand.getSlug());
            br.setLogoUrl(brand.getLogoUrl());
            return brandRequestRepository.saveAndFlush(br);
        }

        BrandRequest br = new BrandRequest();
        br.setApplicantId(applicantId);
        br.setName(brand.getName());
        br.setSlug(brand.getSlug());
        br.setLogoUrl(brand.getLogoUrl());
        br.setStatus(BrandRequestStatus.APPROVED);
        br.setReviewedBy(adminId);
        br.setApprovedBrandId(brand.getId());
        return brandRequestRepository.saveAndFlush(br);
    }
}
