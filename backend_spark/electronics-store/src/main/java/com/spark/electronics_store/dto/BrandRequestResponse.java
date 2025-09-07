package com.spark.electronics_store.dto;

import com.spark.electronics_store.model.BrandRequest;
import com.spark.electronics_store.model.BrandRequestStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BrandRequestResponse {
    private UUID id;
    private String name;
    private String slug;
    private String logoUrl;
    private BrandRequestStatus status;
    private String reason;
    private String reviewedBy;
    private UUID applicantId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private UUID approvedBrandId;

    public static BrandRequestResponse from(BrandRequest req) {
        return BrandRequestResponse.builder()
                .id(req.getId())
                .name(req.getName())
                .slug(req.getSlug())
                .logoUrl(req.getLogoUrl())
                .status(req.getStatus())
                .reason(req.getReason())
                .reviewedBy(req.getReviewedBy())
                .applicantId(req.getApplicantId())
                .createdAt(req.getCreatedAt())
                .updatedAt(req.getUpdatedAt())
                .approvedBrandId(req.getApprovedBrandId())
                .build();
    }
}
