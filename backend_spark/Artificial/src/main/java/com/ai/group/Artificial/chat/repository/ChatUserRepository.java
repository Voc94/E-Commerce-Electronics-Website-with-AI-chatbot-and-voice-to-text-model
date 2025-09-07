// src/main/java/com/ai/group/Artificial/chat/repository/ChatUserRepository.java
package com.ai.group.Artificial.chat.repository;

import com.ai.group.Artificial.chat.model.ChatUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ChatUserRepository extends JpaRepository<ChatUser, UUID> {

    // Return the ENTITY, not a UUID
    Optional<ChatUser> findByEmailIgnoreCase(String email);

    // Optional: if you log in by username too (your table has "name")
    Optional<ChatUser> findByNameIgnoreCase(String name);
}
