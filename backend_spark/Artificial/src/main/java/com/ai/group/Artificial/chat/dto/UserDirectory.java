package com.ai.group.Artificial.chat.dto;

import com.ai.group.Artificial.chat.model.ChatUser;
import com.ai.group.Artificial.chat.repository.ChatUserRepository;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class UserDirectory {
    private final Map<UUID, UserSyncDto> users = new ConcurrentHashMap<>();

    public void upsert(UserSyncDto dto) {
        if (dto == null || dto.id() == null) return;
        if (dto.delete()) {
            users.remove(dto.id());
        } else {
            users.put(dto.id(), dto);
        }
    }

    public void delete(UUID id) {
        if (id != null) users.remove(id);
    }

    public Optional<UserSyncDto> findById(UUID id) {
        return Optional.ofNullable(users.get(id));
    }

    public Optional<UserSyncDto> findByEmail(String email) {
        if (email == null) return Optional.empty();
        String e = email.toLowerCase(Locale.ROOT);
        return users.values().stream()
                .filter(u -> u.email() != null && e.equalsIgnoreCase(u.email()))
                .findFirst();
    }

    public List<UserSyncDto> listAll() {
        return new ArrayList<>(users.values());
    }
}
