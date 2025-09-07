package com.spark.demo.security;

import com.spark.demo.model.AuthProvider;
import com.spark.demo.model.Role;
import com.spark.demo.model.User;
import com.spark.demo.repository.UserRepository;
import com.spark.demo.security.jwt.JwtTokenProvider;
import com.spark.demo.service.UserImageService;
import com.spark.demo.service.UserSyncNotifier; // ⬅️ added
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class OAuth2AuthenticationSuccessHandler implements org.springframework.security.web.authentication.AuthenticationSuccessHandler {

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;
    private final UserImageService imageService;
    private final UserSyncNotifier userSyncNotifier; // ⬅️ added

    @Value("${app.oauth2.authorized-redirect-uri:http://localhost:3000/oauth2/redirect}")
    private String redirectUri;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {
        System.out.println("OAuth2 login successful");

        if (!(authentication instanceof OAuth2AuthenticationToken oauthToken)) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Unsupported authentication type");
            return;
        }

        String registrationId = oauthToken.getAuthorizedClientRegistrationId(); // "google" or "github"
        AuthProvider provider = AuthProvider.valueOf(registrationId.toUpperCase());

        OAuth2User oauthUser = oauthToken.getPrincipal();
        Map<String, Object> attributes = oauthUser.getAttributes();

        System.out.println("OAuth2 attributes received: " + attributes);

        String email = extractEmail(registrationId, attributes);
        Optional<User> userOptional;

        if (email != null && !email.isBlank()) {
            userOptional = userRepository.findByEmail(email.toLowerCase());
        } else {
            String providerIdFallback = extractProviderId(registrationId, attributes);
            if (providerIdFallback == null || providerIdFallback.isBlank()) {
                System.out.println("Neither email nor providerId available from provider: " + registrationId);
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Email not available from provider");
                return;
            }
            userOptional = userRepository.findByProviderAndProviderId(provider, providerIdFallback);
        }

        User user;
        String normalizedEmail = email != null ? email.toLowerCase() : null;
        String name = extractName(registrationId, attributes);
        String imageUrl = extractImage(registrationId, attributes);
        String providerId = extractProviderId(registrationId, attributes);

        if (userOptional.isEmpty()) {
            if (normalizedEmail == null) {
                System.out.println("Cannot register user: no email from provider " + registrationId);
                response.sendError(HttpServletResponse.SC_BAD_REQUEST, "Email not provided, cannot register user");
                return;
            }
            user = User.builder()
                    .provider(provider)
                    .providerId(providerId)
                    .name(name != null ? name : normalizedEmail)
                    .email(normalizedEmail)
                    .imageUrl(imageUrl)
                    .emailVerified(true)
                    .role(Role.USER)
                    .build();
            System.out.println("Registering new OAuth2 user: " + normalizedEmail);
        } else {
            user = userOptional.get();
            user.setName(name != null ? name : user.getName());
            // Only overwrite image if there's no local uploaded image
            boolean hasLocal = imageService.findLocalProfileImagePath(user.getId()) != null;
            if (!hasLocal) {
                user.setImageUrl(imageUrl);
            }
            System.out.println("Updating existing OAuth2 user: " + user.getEmail());
        }

        userRepository.save(user);

        // ⬇️ NEW: ensure the user is synced to the store service after every successful OAuth2 login
        try {
            userSyncNotifier.notifyUpsert(user);
        } catch (Exception e) {
            System.err.println("WARN: notifyUpsert failed in OAuth2 success handler for "
                    + user.getId() + ": " + e.getMessage());
        }

        String token = tokenProvider.generateToken(user);
        System.out.println("Generated JWT token for user: " + (user.getEmail() != null ? user.getEmail() : "[unknown]"));

        String targetUrl = redirectUri + "?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8);
        System.out.println("Redirecting to: " + targetUrl);

        response.sendRedirect(targetUrl);
    }

    private String extractEmail(String provider, Map<String, Object> attrs) {
        if ("google".equalsIgnoreCase(provider) || "github".equalsIgnoreCase(provider)) {
            return (String) attrs.get("email");
        }
        return null;
    }

    private String extractName(String provider, Map<String, Object> attrs) {
        if ("google".equalsIgnoreCase(provider)) {
            return (String) attrs.get("name");
        } else if ("github".equalsIgnoreCase(provider)) {
            Object name = attrs.get("name");
            if (name instanceof String s && !s.isBlank()) {
                return s;
            }
            return (String) attrs.get("login");
        }
        return null;
    }

    private String extractImage(String provider, Map<String, Object> attrs) {
        if ("google".equalsIgnoreCase(provider)) {
            return (String) attrs.get("picture");
        } else if ("github".equalsIgnoreCase(provider)) {
            return (String) attrs.get("avatar_url");
        }
        return null;
    }

    private String extractProviderId(String provider, Map<String, Object> attrs) {
        if ("google".equalsIgnoreCase(provider)) {
            return (String) attrs.get("sub");
        } else if ("github".equalsIgnoreCase(provider)) {
            return String.valueOf(attrs.get("id"));
        }
        return null;
    }
}
