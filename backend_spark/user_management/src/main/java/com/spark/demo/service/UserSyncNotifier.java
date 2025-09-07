package com.spark.demo.service;

import com.spark.demo.dto.UserSyncDto;
import com.spark.demo.model.User;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class UserSyncNotifier {

    private static final Logger log = LoggerFactory.getLogger(UserSyncNotifier.class);
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${sync.store-base-url}")
    private String storeBaseUrl;   // http://localhost:8081

    @Value("${sync.agents-base-url}")
    private String agentsBaseUrl;  // http://localhost:8082

    @Value("${sync.shared-secret}")
    private String sharedSecret;   // e.g. moldo

    // ---------- helpers ----------
    private static String trimBase(String s) {
        return (s == null) ? null : s.replaceAll("/$", "");
    }

    private HttpHeaders authJsonHeaders() {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(sharedSecret);
        h.setContentType(MediaType.APPLICATION_JSON);
        return h;
    }

    private static String describe(RestClientException ex) {
        if (ex instanceof RestClientResponseException r) {
            String body = null;
            try {
                body = r.getResponseBodyAsString();
                if (body != null && body.length() > 512) body = body.substring(0, 512) + " …(truncated)";
            } catch (Exception ignore) {}
            return r.getRawStatusCode() + " " + r.getStatusText() + " body=" + (body == null ? "<no body>" : body.trim());
        }
        return ex.getMessage();
    }

    // ---------- API ----------
    @Retryable(value = RestClientException.class,
            backoff = @Backoff(delay = 2000, multiplier = 2, maxDelay = 20000))
    public void notifyUpsert(User user) {
        UserSyncDto dto = new UserSyncDto(
                user.getId(),
                user.getEmail(),
                user.getName(),
                user.getRole().name(),
                user.getTokenVersion(),
                false
        );
        HttpEntity<UserSyncDto> req = new HttpEntity<>(dto, authJsonHeaders());

        RestClientException last = null;

        // 1) store (8081)
        try {
            String url1 = trimBase(storeBaseUrl) + "/internal/sync/users";
            restTemplate.postForEntity(url1, req, Void.class);
            log.debug("Synced upsert to {} for user {}", url1, user.getId());
        } catch (RestClientException ex) {
            last = ex;
            log.warn("Upsert sync to store failed: {}", describe(ex));
        }

        // 2) agents (8082)
        try {
            String url2 = trimBase(agentsBaseUrl) + "/internal/sync/users";
            restTemplate.postForEntity(url2, req, Void.class);
            log.debug("Synced upsert to {} for user {}", url2, user.getId());
        } catch (RestClientException ex) {
            last = ex;
            log.warn("Upsert sync to agents failed: {}", describe(ex));
        }

        if (last != null) throw last; // trigger @Retryable if any failed
    }

    @Recover
    public void recoverUpsert(RestClientException ex, User user) {
        log.error("Failed to sync upsert for user {} after retries: {}", user.getId(), describe(ex));
    }

    @Retryable(value = RestClientException.class,
            backoff = @Backoff(delay = 2000, multiplier = 2, maxDelay = 20000))
    public void notifyDelete(UUID userId) {
        HttpEntity<Void> req = new HttpEntity<>(authJsonHeaders());
        RestClientException last = null;

        try {
            String url1 = trimBase(storeBaseUrl) + "/internal/sync/users/" + userId;
            restTemplate.exchange(url1, HttpMethod.DELETE, req, Void.class);
            log.debug("Synced delete to {}", url1);
        } catch (RestClientException ex) {
            last = ex;
            log.warn("Delete sync to store failed: {}", describe(ex));
        }

        try {
            String url2 = trimBase(agentsBaseUrl) + "/internal/sync/users/" + userId;
            restTemplate.exchange(url2, HttpMethod.DELETE, req, Void.class);
            log.debug("Synced delete to {}", url2);
        } catch (RestClientException ex) {
            last = ex;
            log.warn("Delete sync to agents failed: {}", describe(ex));
        }

        if (last != null) throw last;
    }

    @Recover
    public void recoverDelete(RestClientException ex, UUID userId) {
        log.error("Failed to sync delete for user {} after retries: {}", userId, describe(ex));
    }
}
