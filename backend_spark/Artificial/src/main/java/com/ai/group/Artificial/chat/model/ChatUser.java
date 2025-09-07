package com.ai.group.Artificial.chat.model;

import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "chat_users")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatUser {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    /**
     * IMPORTANT:
     * - Null on first persist -> Spring Data treats entity as NEW (persist)
     * - Non-null on updates -> optimistic locking
     */
    @Version
    @Column(name = "version")
    private Long version;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(name = "token_version", nullable = false)
    private int tokenVersion;
}
