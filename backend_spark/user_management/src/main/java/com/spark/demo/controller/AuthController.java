package com.spark.demo.controller;

import com.spark.demo.dto.AuthResponse;
import com.spark.demo.dto.LoginRequest;
import com.spark.demo.dto.RegisterRequest;
import com.spark.demo.model.AuthProvider;
import com.spark.demo.model.User;
import com.spark.demo.model.Role;
import com.spark.demo.repository.UserRepository;
import com.spark.demo.security.jwt.JwtTokenProvider;
import com.spark.demo.service.UserImageService;
import com.spark.demo.service.UserSyncNotifier;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import com.spark.demo.dto.ChangePasswordRequest;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.Principal;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@CrossOrigin(origins = "http://localhost:3000")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider tokenProvider;
    private final UserImageService imageService;
    private final UserSyncNotifier userSyncNotifier ;
    @Value("${upload.base-dir}")
    private String uploadBaseDir;

    @Value("${baseUrl:http://localhost:8080}")
    private String baseUrl;

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String email = principal.getName().toLowerCase(Locale.ROOT);

        return userRepository.findByEmail(email)
                .<ResponseEntity<?>>map(user -> {
                    // If there's a locally stored image file, prefer that (override in-memory only)
                    if (imageService.findLocalProfileImagePath(user.getId()) != null) {
                        user.setImageUrl(baseUrl.replaceAll("/$", "") + "/auth/me/image");
                    }
                    return ResponseEntity.ok(user);
                })
                .orElse(ResponseEntity.status(404).body(Map.of("error", "User not found")));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(
            @Valid @RequestBody RegisterRequest request,
            BindingResult br
    ) {
        if (br.hasErrors()) {
            String errors = br.getFieldErrors().stream()
                    .map(f -> f.getField() + ": " + f.getDefaultMessage())
                    .collect(Collectors.joining("; "));
            return ResponseEntity.badRequest().body(Map.of("error", errors));
        }

        String normalizedEmail = request.email().toLowerCase(Locale.ROOT);
        if (userRepository.findByEmail(normalizedEmail).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email already in use"));
        }

        User user = new User();
        user.setName(request.name());
        user.setProvider(AuthProvider.LOCAL);
        user.setEmail(normalizedEmail);
        user.setEmailVerified(true);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(Role.USER);
        user.setImageUrl(baseUrl.replaceAll("/$", "") + "/auth/me/image");
        userRepository.save(user);
        userSyncNotifier.notifyUpsert(user);

        String token = tokenProvider.generateToken(user);
        long expiresIn = tokenProvider.getJwtExpirationMs();

        return ResponseEntity.ok(new AuthResponse(token, expiresIn));
    }


    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.email(), request.password())
            );

            User user = userRepository.findByEmail(request.email().toLowerCase(Locale.ROOT))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

            String token = tokenProvider.generateToken(user);
            long expiresIn = tokenProvider.getJwtExpirationMs();

            return ResponseEntity.ok(new AuthResponse(token, expiresIn));
        } catch (AuthenticationException ex) {
            return ResponseEntity.status(401).body(Map.of("error", "Invalid credentials"));
        }
    }

    @PostMapping("/me/image")
    public ResponseEntity<?> uploadProfileImage(Principal principal,
                                                @RequestParam("image") MultipartFile image) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String email = principal.getName().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        try {
            imageService.storeProfileImage(image, user.getId());
            // ensure sentinel remains for local users
            user.setImageUrl(baseUrl.replaceAll("/$", "") + "/auth/me/image");
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("imageUrl", user.getImageUrl()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to store image"));
        }
    }
    private ResponseEntity<?> serveDefaultAvatar() {
        try {
            // Place default-avatar.png under src/main/resources/static/images/default-avatar.png
            Path p = Paths.get("src/main/resources/static/images/default-avatar.png").toAbsolutePath().normalize();
            byte[] bytes = Files.readAllBytes(p);
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .body(bytes);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "No default avatar available"));
        }
    }

    @GetMapping("/me/image")
    public ResponseEntity<?> getProfileImage(Principal principal) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String email = principal.getName().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // 1. Try locally stored image first
        try {
            Path localImage = imageService.findLocalProfileImagePath(user.getId());
            if (localImage != null) {
                if (Files.exists(localImage) && Files.isReadable(localImage)) {
                    byte[] bytes = Files.readAllBytes(localImage);
                    String probeType = Files.probeContentType(localImage);
                    MediaType mediaType = (probeType != null) ? MediaType.parseMediaType(probeType)
                            : MediaType.APPLICATION_OCTET_STREAM;
                    return ResponseEntity.ok().contentType(mediaType).body(bytes);
                }
            }

            // 2. Remote image (Google / GitHub)
            String imageUrl = user.getImageUrl();
            String sentinel = baseUrl.replaceAll("/$", "") + "/auth/me/image";
            if (imageUrl != null && imageUrl.startsWith("http") && !imageUrl.equalsIgnoreCase(sentinel)) {
                RestTemplate rest = new RestTemplate();
                ResponseEntity<byte[]> resp = rest.getForEntity(imageUrl, byte[].class);
                if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                    String contentType = resp.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE);
                    MediaType mediaType = (contentType != null) ? MediaType.parseMediaType(contentType)
                            : MediaType.APPLICATION_OCTET_STREAM;
                    return ResponseEntity.ok()
                            .contentType(mediaType)
                            .body(resp.getBody());
                } else {
                    return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                            .body(Map.of("error", "Failed to fetch remote image"));
                }
            }

            // 3. Fallback default avatar
            return serveDefaultAvatar();
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to load image"));
        }
    }
    @PostMapping("/me/change-password")
    public ResponseEntity<?> changePassword(
            Principal principal,
            @Valid @RequestBody ChangePasswordRequest request,
            BindingResult br
    ) {
        if (principal == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        if (br.hasErrors()) {
            String errors = br.getFieldErrors().stream()
                    .map(f -> f.getField() + ": " + f.getDefaultMessage())
                    .collect(Collectors.joining("; "));
            return ResponseEntity.badRequest().body(Map.of("error", errors));
        }

        String email = principal.getName().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Only allow changing password for LOCAL users
        if (!AuthProvider.LOCAL.equals(user.getProvider())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot change password for OAuth users"));
        }

        // Verify current password
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            return ResponseEntity.status(401).body(Map.of("error", "Current password is incorrect"));
        }

        // Prevent using same password
        if (request.currentPassword().equals(request.newPassword())) {
            return ResponseEntity.badRequest().body(Map.of("error", "New password must be different from current password"));
        }

        // Update
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        // Optionally issue a fresh token so frontend can keep session valid
        String token = tokenProvider.generateToken(user);
        long expiresIn = tokenProvider.getJwtExpirationMs();

        return ResponseEntity.ok(new AuthResponse(token, expiresIn));
    }

}
