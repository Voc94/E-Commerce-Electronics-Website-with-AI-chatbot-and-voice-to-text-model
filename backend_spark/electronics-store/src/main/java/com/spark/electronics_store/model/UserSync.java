package com.spark.electronics_store.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "synced_users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSync {

    @Id
    @Column(columnDefinition = "uuid")
    private UUID id;

    private String email;
    private String name;

    @Enumerated(EnumType.STRING)
    private Role role;

    private int tokenVersion;

    private boolean deleted = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_id")
    private Brand brand;


    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public boolean isActiveBrandSellerOf(UUID targetBrandId) {
        return !deleted
                && role == Role.BRAND_SELLER
                && brand != null
                && brand.getId().equals(targetBrandId);
    }
}
