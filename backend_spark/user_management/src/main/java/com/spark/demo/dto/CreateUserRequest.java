// src/main/java/com/spark/demo/dto/CreateUserRequest.java
package com.spark.demo.dto;

import com.spark.demo.model.AuthProvider;
import com.spark.demo.model.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateUserRequest {
    @NotBlank
    private String name;

    @Email
    @NotBlank
    private String email;

    /**
     * Only required/used when provider == LOCAL.
     * If omitted for LOCAL, registration will fail.
     */
    private String password;

    @NotNull
    private Role role;

    private boolean emailVerified = false;

    @NotNull
    private AuthProvider provider;

    /**
     * Required if provider is OAuth (e.g., GOOGLE or GITHUB)
     */
    private String providerId;
}
