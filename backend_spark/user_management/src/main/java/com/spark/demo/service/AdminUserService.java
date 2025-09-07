package com.spark.demo.service;

import com.spark.demo.dto.AdminUserResponse;
import com.spark.demo.dto.CreateUserRequest;
import com.spark.demo.dto.UpdateUserRequest;
import com.spark.demo.model.AuthProvider;
import com.spark.demo.model.User;
import com.spark.demo.repository.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminUserService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserSyncNotifier userSyncNotifier; // <--- injected

    private AdminUserResponse toResponse(User u) {
        return AdminUserResponse.builder()
                .id(u.getId())
                .provider(u.getProvider())
                .providerId(u.getProviderId())
                .name(u.getName())
                .email(u.getEmail())
                .imageUrl(u.getImageUrl())
                .emailVerified(u.isEmailVerified())
                .role(u.getRole())
                .createdAt(u.getCreatedAt())
                .updatedAt(u.getUpdatedAt())
                .build();
    }

    public List<AdminUserResponse> listAll() {
        return userRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public AdminUserResponse get(UUID id) {
        User u = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return toResponse(u);
    }

    @Transactional
    public AdminUserResponse create(CreateUserRequest req) {
        String emailNorm = req.getEmail().toLowerCase(Locale.ROOT).trim();
        if (userRepository.findByEmail(emailNorm).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already in use");
        }

        if (req.getProvider() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Provider is required");
        }

        if (req.getProvider() == AuthProvider.LOCAL) {
            if (req.getPassword() == null || req.getPassword().length() < 8) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password required and must be >=8 chars for LOCAL user");
            }
        } else {
            if (req.getProviderId() == null || req.getProviderId().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "providerId required for OAuth user");
            }
        }

        User.UserBuilder builder = User.builder()
                .name(req.getName())
                .email(emailNorm)
                .provider(req.getProvider())
                .providerId(req.getProviderId())
                .role(req.getRole())
                .emailVerified(req.isEmailVerified());

        if (req.getProvider() == AuthProvider.LOCAL) {
            builder.password(passwordEncoder.encode(req.getPassword()));
        }

        User user = builder.build();
        userRepository.save(user);

        // sync to store (non-blocking in sense of not failing flow if sync eventually fails)
        try {
            userSyncNotifier.notifyUpsert(user);
        } catch (Exception e) {
            log.warn("Failed to notify store about created user {}: {}", user.getId(), e.getMessage());
        }

        return toResponse(user);
    }

    @Transactional
    public AdminUserResponse update(UUID id, UpdateUserRequest req) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (req.getEmail() != null && !req.getEmail().isBlank()) {
            String emailNorm = req.getEmail().toLowerCase(Locale.ROOT).trim();
            if (!emailNorm.equals(user.getEmail()) && userRepository.findByEmail(emailNorm).isPresent()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already in use");
            }
            user.setEmail(emailNorm);
        }

        if (req.getName() != null && !req.getName().isBlank()) {
            user.setName(req.getName());
        }

        if (req.getRole() != null) {
            user.setRole(req.getRole());
        }

        if (req.getEmailVerified() != null) {
            user.setEmailVerified(req.getEmailVerified());
        }

        if (req.getPassword() != null && !req.getPassword().isBlank()) {
            if (user.getProvider() != AuthProvider.LOCAL) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot set password for non-LOCAL user");
            }
            if (req.getPassword().length() < 8) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters");
            }
            user.setPassword(passwordEncoder.encode(req.getPassword()));
        }

        userRepository.save(user);

        try {
            userSyncNotifier.notifyUpsert(user);
        } catch (Exception e) {
            log.warn("Failed to notify store about updated user {}: {}", user.getId(), e.getMessage());
        }

        return toResponse(user);
    }

    public void delete(UUID id) {
        if (!userRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }

        userRepository.deleteById(id);

        try {
            userSyncNotifier.notifyDelete(id);
        } catch (Exception e) {
            log.warn("Failed to notify store about deleted user {}: {}", id, e.getMessage());
        }
    }
}
