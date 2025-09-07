// src/main/java/com/ai/group/Artificial/admin/service/AdminRequestService.java
package com.ai.group.Artificial.admin.service;

import com.ai.group.Artificial.admin.model.AdminRequest;
import com.ai.group.Artificial.admin.model.AdminRequestStatus;
import com.ai.group.Artificial.admin.repository.AdminRequestRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminRequestService {

    private final AdminRequestRepository repo;

    /** Create (or reuse) an awaiting request for this user. */
    @Transactional
    public AdminRequest createAwaiting(UUID userId, String initialMessage) {
        if (userId == null) {
            // no user — skip persistence, just return a transient object
            AdminRequest transientReq = new AdminRequest();
            transientReq.setUserId(null);
            transientReq.setInitialMessage(initialMessage);
            transientReq.setStatus(AdminRequestStatus.AWAITING);
            return transientReq;
        }

        Optional<AdminRequest> existing = repo.findTopByUserIdAndStatusOrderByCreatedAtDesc(
                userId, AdminRequestStatus.AWAITING
        );
        if (existing.isPresent()) {
            AdminRequest req = existing.get();
            if (initialMessage != null && !initialMessage.isBlank()) {
                req.setInitialMessage(initialMessage);
            }
            return req; // updated in-place within Tx
        }

        AdminRequest req = new AdminRequest();
        req.setUserId(userId);
        req.setInitialMessage(initialMessage);
        req.setStatus(AdminRequestStatus.AWAITING);
        return repo.save(req);
    }

    /** Mark as accepted and attach the admin who took it. */
    @Transactional
    public AdminRequest accept(UUID requestId, UUID adminId) {
        AdminRequest req = repo.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("AdminRequest not found: " + requestId));
        if (req.getStatus() == AdminRequestStatus.ACCEPTED) {
            return req; // already accepted
        }
        req.setStatus(AdminRequestStatus.ACCEPTED);
        req.setAcceptedAt(Instant.now());
        req.setAcceptedBy(adminId);
        return req;
    }

    public List<AdminRequest> listAwaiting() {
        return repo.findAllByStatusOrderByCreatedAtAsc(AdminRequestStatus.AWAITING);
    }

    public AdminRequest getByIdOrThrow(UUID id) {
        return repo.findById(id).orElseThrow(() -> new IllegalArgumentException("AdminRequest not found: " + id));
    }
    public List<AdminRequest> findOpenByParticipant(UUID participantId) {
        return repo.findAllOpenByParticipant(participantId);
    }
}
