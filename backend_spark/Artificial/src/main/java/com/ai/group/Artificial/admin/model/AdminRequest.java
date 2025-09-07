// com/ai/group/Artificial/admin/AdminRequest.java
package com.ai.group.Artificial.admin.model;

import jakarta.persistence.*;
import lombok.Getter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Entity
@Table(name = "admin_requests", indexes = {
        @Index(name = "ix_admin_requests_user_status", columnList = "userId,status"),
        @Index(name = "ix_admin_requests_status_created", columnList = "status,createdAt")
})
public class AdminRequest {

    // getters/setters
    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AdminRequestStatus status;

    @Column(nullable = false)
    private Instant createdAt;

    @Column
    private Instant acceptedAt;

    @Column
    private UUID acceptedBy;

    @Column(length = 2000)
    private String initialMessage;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = AdminRequestStatus.AWAITING;
    }

    public void setUserId(UUID userId) { this.userId = userId; }

    public void setStatus(AdminRequestStatus status) { this.status = status; }

    public void setAcceptedAt(Instant acceptedAt) { this.acceptedAt = acceptedAt; }

    public void setAcceptedBy(UUID acceptedBy) { this.acceptedBy = acceptedBy; }

    public void setInitialMessage(String initialMessage) { this.initialMessage = initialMessage; }
}
