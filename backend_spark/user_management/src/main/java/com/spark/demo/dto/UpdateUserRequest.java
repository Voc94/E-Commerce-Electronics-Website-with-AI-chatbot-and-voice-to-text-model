// src/main/java/com/spark/demo/dto/UpdateUserRequest.java
package com.spark.demo.dto;

import com.spark.demo.model.Role;
import jakarta.validation.constraints.Email;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateUserRequest {
    private String name;

    @Email
    private String email;

    /**
     * If present and user.provider == LOCAL, this will reset the password.
     */
    private String password;

    private Role role;

    private Boolean emailVerified;
}
