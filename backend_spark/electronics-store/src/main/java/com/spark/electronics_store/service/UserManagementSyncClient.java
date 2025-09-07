package com.spark.electronics_store.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class UserManagementSyncClient {

    // simple RestTemplate is fine; if you already have a bean, inject that instead
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${sync.user-base-url:http://localhost:8080}")
    private String userBaseUrl;

    @Value("${sync.shared-secret:moldo}")
    private String sharedSecret;

    /**
     * Minimal upsert: tell user-management to set role for a user id.
     * It hits: POST {userBaseUrl}/internal/sync/users  (your existing endpoint)
     * Body only needs id + role; other fields remain unchanged there.
     */
    public void notifyRole(UUID userId, String roleName) {
        String url = userBaseUrl + "/internal/sync/users";

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(sharedSecret);
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> body = Map.of(
                "id", userId.toString(),
                "role", roleName
        );

        restTemplate.postForEntity(url, new HttpEntity<>(body, headers), Void.class);
        log.info("Synced role '{}' to user-management for user {}", roleName, userId);
    }
}
