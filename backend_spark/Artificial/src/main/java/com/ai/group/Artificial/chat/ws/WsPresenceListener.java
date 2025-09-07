// src/main/java/com/ai/group/Artificial/chat/ws/WsPresenceListener.java
package com.ai.group.Artificial.chat.ws;

import com.ai.group.Artificial.admin.model.AdminRequest;
import com.ai.group.Artificial.admin.service.AdminRequestService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class WsPresenceListener {

    private final SimpMessagingTemplate simp;
    private final AdminRequestService adminRequests;

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        Principal p = event.getUser();
        UUID uid = principalId(p);
        if (uid == null) return;

        // All active (accepted/not closed) requests where this user participates
        List<AdminRequest> open = adminRequests.findOpenByParticipant(uid);

        for (AdminRequest req : open) {
            String who;
            if (uid.equals(req.getAcceptedBy())) who = "ADMIN";
            else if (uid.equals(req.getUserId())) who = "USER";
            else who = "UNKNOWN";

            Map<String, Object> payload = Map.of(
                    "type", "DISCONNECTED",
                    "who", who,
                    "requestId", req.getId().toString(),
                    "at", Instant.now().toEpochMilli()
            );

            // Your clients already listen to this topic for ACCEPT/CLOSE;
            // they'll now receive DISCONNECTED as well.
            simp.convertAndSend("/topic/support/requests/" + req.getId(), payload);
        }
    }

    private static UUID principalId(Principal p) {
        if (p instanceof WsPrincipal wp) return wp.id();
        try { return UUID.fromString(p.getName()); } catch (Exception e) { return null; }
    }
}
