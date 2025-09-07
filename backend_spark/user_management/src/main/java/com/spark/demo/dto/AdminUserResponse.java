// src/main/java/com/spark/demo/dto/AdminUserResponse.java
package com.spark.demo.dto;

import com.spark.demo.model.AuthProvider;
import com.spark.demo.model.Role;
import lombok.*;
import java.util.UUID;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserResponse {
    private UUID id;
    private AuthProvider provider;
    private String providerId;
    private String name;
    private String email;
    private String imageUrl;
    private boolean emailVerified;
    private Role role;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
