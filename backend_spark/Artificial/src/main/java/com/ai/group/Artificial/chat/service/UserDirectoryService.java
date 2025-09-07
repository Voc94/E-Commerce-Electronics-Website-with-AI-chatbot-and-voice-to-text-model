package com.ai.group.Artificial.chat.service;

import com.ai.group.Artificial.chat.dto.UserSyncDto;
import com.ai.group.Artificial.chat.model.ChatUser;
import com.ai.group.Artificial.chat.model.Role;
import com.ai.group.Artificial.chat.repository.ChatUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class UserDirectoryService {

    private final ChatUserRepository repo;

    public void upsert(UserSyncDto dto) {
        if (dto.delete()) {
            delete(dto.id());
            return;
        }

        repo.findById(dto.id()).ifPresentOrElse(existing -> {
            // Managed entity inside Tx: just mutate; flush will write UPDATE
            existing.setEmail(dto.email());
            existing.setName(dto.name());
            existing.setRole(Role.valueOf(dto.role()));
            existing.setTokenVersion(dto.tokenVersion());
            // repo.save(existing); // not required, but harmless
        }, () -> {
            // Version is null -> persist (INSERT), no stale-state issues
            ChatUser created = ChatUser.builder()
                    .id(dto.id())
                    .email(dto.email())
                    .name(dto.name())
                    .role(Role.valueOf(dto.role()))
                    .tokenVersion(dto.tokenVersion())
                    .build();
            repo.save(created);
        });
    }

    public void delete(UUID id) {
        repo.deleteById(id);
    }
    @Transactional(readOnly = true)
    public Optional<UUID> findIdByEmail(String email) {
        if (email == null) return Optional.empty();
        return repo.findByEmailIgnoreCase(email).map(ChatUser::getId);
    }

    @Transactional(readOnly = true)
    public Optional<UUID> findIdByUsernameOrEmail(String s) {
        if (s == null) return Optional.empty();
        return repo.findByEmailIgnoreCase(s).map(ChatUser::getId)
                .or(() -> repo.findByNameIgnoreCase(s).map(ChatUser::getId));
    }

    /** Count users in the database. */
    @Transactional(readOnly = true)
    public int size() {
        return Math.toIntExact(repo.count()); // or return long count() if you prefer
    }
}
