package com.spark.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
public class AuthResponse {
    @Setter
    private String token;

    @JsonProperty("token_type")
    private final String tokenType = "Bearer";

    @Setter
    @Getter
    @JsonProperty("expires_in_ms")
    private long expiresInMillis;

    public AuthResponse(String token, long expiresInMillis) {
        this.token = token;
        this.expiresInMillis = expiresInMillis;
    }

}