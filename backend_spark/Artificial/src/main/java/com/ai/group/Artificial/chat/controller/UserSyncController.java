package com.ai.group.Artificial.chat.controller;

import com.ai.group.Artificial.chat.dto.UserSyncDto;
import com.ai.group.Artificial.chat.service.UserDirectoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/internal/sync/users")
public class UserSyncController {

    private final UserDirectoryService service;

    @PostMapping
    public ResponseEntity<Void> upsert(@RequestBody UserSyncDto dto) {
        service.upsert(dto);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
