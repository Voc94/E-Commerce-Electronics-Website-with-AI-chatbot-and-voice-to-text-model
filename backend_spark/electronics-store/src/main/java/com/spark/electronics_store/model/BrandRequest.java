package com.spark.electronics_store.model;


import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "brand_requests")
public class BrandRequest {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String slug;

    private String logoUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private BrandRequestStatus status;

    // If rejected, a reason
    private String reason;

    // Who approved/rejected (username or identifier)
    private String reviewedBy;

    // Optional: who requested it (could be userSync ID or external identifier)
    private UUID applicantId;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    // If approved, the resulting brand id (for reference)
    private UUID approvedBrandId;
}
