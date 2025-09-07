// src/main/java/com/ai/group/Artificial/chat/model/ChatMessage.java
package com.ai.group.Artificial.chat.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "chat_messages",
        indexes = {
                @Index(name = "ix_chatmsg_request", columnList = "request_id"),
                @Index(name = "ix_chatmsg_created", columnList = "created_at")
        })
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessage {

    @Id
    @UuidGenerator
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "request_id", nullable = false)
    private UUID requestId;     // AdminRequest.id

    @Column(name = "sender_id", nullable = false)
    private UUID senderId;      // ChatUser.id (user or admin)

    @Column(name = "body", nullable = false, columnDefinition = "text")
    private String body;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    public void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (body == null) body = "";
    }

    /** Convenience factory. */
    public static ChatMessage of(UUID requestId, UUID senderId, String body) {
        return ChatMessage.builder()
                .requestId(requestId)
                .senderId(senderId)
                .body(body == null ? "" : body.trim())
                .createdAt(Instant.now())
                .build();
    }
}
