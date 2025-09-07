package com.spark.demo.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @UuidGenerator // modern Hibernate 6+ UUID generator (defaults to RANDOM/v4)
    @Column(columnDefinition = "uuid", updatable = false, nullable = false)
    private UUID id;

    @Enumerated(EnumType.STRING)
    private AuthProvider provider; // GOOGLE, FACEBOOK, LOCAL

    private String providerId; // Only for OAuth2

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    private String password; // Only for LOCAL registration

    private String imageUrl;

    private boolean emailVerified = false;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private Role role = Role.USER;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    @Column(nullable = false)
    private int tokenVersion = 0;

    public void bumpTokenVersion() {
        this.tokenVersion++;
    }

}
