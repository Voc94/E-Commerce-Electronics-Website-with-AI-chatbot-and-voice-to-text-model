// src/main/java/com/ai/group/Artificial/admin/controller/AdminRequestController.java
package com.ai.group.Artificial.admin.controller;

import com.ai.group.Artificial.admin.model.AdminRequest;
import com.ai.group.Artificial.admin.service.AdminRequestService;
import com.ai.group.Artificial.chat.service.UserDirectoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin-requests")
public class AdminRequestController {

    private final AdminRequestService service;
    private final SimpMessagingTemplate simp;
    private final UserDirectoryService users;

    public AdminRequestController(AdminRequestService service,
                                  SimpMessagingTemplate simp,
                                  UserDirectoryService users) {
        this.service = service;
        this.simp = simp;
        this.users = users;
    }

    // Create/ensure an awaiting request for the *authenticated* user
    @PostMapping
    public ResponseEntity<AdminRequest> create(@AuthenticationPrincipal Jwt jwt,
                                               @RequestBody CreateRequest body) {
        UUID userId = resolveIdFromJwt(jwt);
        AdminRequest req = service.createAwaiting(userId, body.initialMessage());
        return ResponseEntity.ok(req);
    }

    // Accept a request; admin comes from the *authenticated* principal
    @PostMapping("/{id}/accept")
    public ResponseEntity<AdminRequest> accept(@PathVariable UUID id,
                                               @AuthenticationPrincipal Jwt jwt) {
        UUID adminId = resolveIdFromJwt(jwt);
        AdminRequest req = service.accept(id, adminId);

        // 🔔 notify the waiting user widget
        simp.convertAndSend("/topic/support/requests/" + id,
                Map.of("type", "accepted",
                        "status", "ACCEPTED",
                        "adminId", adminId));

        return ResponseEntity.ok(req);
    }

    // List all awaiting (unchanged)
    @GetMapping("/awaiting")
    public ResponseEntity<List<AdminRequest>> awaiting() {
        return ResponseEntity.ok(service.listAwaiting());
    }

    // --- helpers & DTOs ---

    private UUID resolveIdFromJwt(Jwt jwt) {
        // 1) try UUID-ish claims straight from token
        for (String key : new String[]{"id", "sub", "userId", "uid"}) {
            String raw = str(jwt, key);
            if (StringUtils.hasText(raw)) {
                try { return UUID.fromString(raw); } catch (Exception ignore) {}
            }
        }
        // 2) fallback by email via directory (must have been synced)
        String email = str(jwt, "email");
        return users.findIdByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Cannot resolve user id from JWT (email=" + email + ")"));
    }

    private static String str(Jwt jwt, String name) {
        Object v = jwt.getClaims().get(name);
        return v != null ? v.toString() : null;
    }

    // Keep DTOs for compatibility; the IDs are now ignored server-side.
    public record CreateRequest(
            UUID userId,          // ignored
            String initialMessage
    ) {}
}
