// src/main/java/com/ai/group/Artificial/chat/ws/ChatWsController.java
package com.ai.group.Artificial.chat.controller;

import com.ai.group.Artificial.admin.model.AdminRequest;
import com.ai.group.Artificial.admin.service.AdminRequestService;
import com.ai.group.Artificial.chat.model.ChatMessage;
import com.ai.group.Artificial.chat.repository.ChatMessageRepository;
import com.ai.group.Artificial.chat.ws.WsPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.*;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Objects;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
public class ChatWsController {

    private final SimpMessagingTemplate simp;
    private final AdminRequestService adminRequests;
    private final ChatMessageRepository messages;

    // Client sends to: /app/chat/{requestId}
    // Payload: { "body": "hello" }
    @MessageMapping("/chat/{requestId}")
    public void send(@DestinationVariable UUID requestId,
                     @Payload NewMessagePayload inbound,
                     Principal principal) {

        UUID senderId = principalId(principal);
        if (senderId == null) {
            throw new IllegalArgumentException("Unauthenticated WebSocket principal.");
        }

        AdminRequest req = adminRequests.getByIdOrThrow(requestId);

        // Only the two participants can chat (userId + acceptedBy)
        boolean isMember = Objects.equals(senderId, req.getUserId())
                || Objects.equals(senderId, req.getAcceptedBy());
        if (!isMember) {
            throw new IllegalArgumentException("Not a participant in this chat.");
        }

        // Persist the message
        ChatMessage saved = messages.save(ChatMessage.of(requestId, senderId, inbound.body()));

        // Deliver privately to BOTH sides via user queues
        // convertAndSendToUser uses Principal.getName(); we name users by their UUID string
        String dest = "/queue/chat/" + requestId;

        // echo to sender
        simp.convertAndSendToUser(senderId.toString(), dest, saved);

        // send to the other party if present
        UUID target = Objects.equals(senderId, req.getUserId()) ? req.getAcceptedBy() : req.getUserId();
        if (target != null) {
            simp.convertAndSendToUser(target.toString(), dest, saved);
        }
    }

    private static UUID principalId(Principal p) {
        if (p instanceof WsPrincipal wp) return wp.id();
        try { return UUID.fromString(p.getName()); } catch (Exception e) { return null; }
    }

    /** Minimal payload the client sends. */
    public record NewMessagePayload(String body) {}
}
