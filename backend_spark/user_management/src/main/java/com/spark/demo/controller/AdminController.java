package com.spark.demo.controller;

import com.spark.demo.dto.AdminUserResponse;
import com.spark.demo.dto.CreateUserRequest;
import com.spark.demo.dto.UpdateUserRequest;
import com.spark.demo.service.AdminUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminUserService userService;

    @GetMapping
    public List<AdminUserResponse> listUsers() {
        return userService.listAll();
    }

    @GetMapping("/{id}")
    public AdminUserResponse getUser(@PathVariable UUID id) {
        return userService.get(id);
    }

    @PostMapping
    public ResponseEntity<AdminUserResponse> createUser(@Valid @RequestBody CreateUserRequest req) {
        AdminUserResponse created = userService.create(req);
        return ResponseEntity.status(201).body(created);
    }

    @PutMapping("/{id}")
    public AdminUserResponse updateUser(@PathVariable UUID id, @Valid @RequestBody UpdateUserRequest req) {
        return userService.update(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable UUID id) {
        userService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
