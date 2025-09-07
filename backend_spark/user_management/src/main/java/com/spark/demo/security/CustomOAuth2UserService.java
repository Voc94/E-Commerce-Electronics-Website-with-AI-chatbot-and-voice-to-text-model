package com.spark.demo.security;

import com.spark.demo.model.AuthProvider;
import com.spark.demo.model.Role;
import com.spark.demo.model.User;
import com.spark.demo.repository.UserRepository;
import com.spark.demo.service.UserImageService;
import com.spark.demo.service.UserSyncNotifier;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private static final Logger log = LoggerFactory.getLogger(CustomOAuth2UserService.class);

    private final UserRepository userRepository;
    private final UserImageService imageService;
    private final UserSyncNotifier userSyncNotifier;
    @Override
    public OAuth2User loadUser(OAuth2UserRequest request) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(request);
        String registrationId = request.getClientRegistration().getRegistrationId().toLowerCase(); // "google" or "github"
        Map<String, Object> attributes = oAuth2User.getAttributes();

        String email = extractEmail(registrationId, attributes, request);
        if (email == null || email.isBlank()) {
            throw new OAuth2AuthenticationException(new org.springframework.security.oauth2.core.OAuth2Error("email_not_found"),
                    "Email not provided by " + registrationId);
        }
        email = email.toLowerCase(Locale.ROOT).trim();

        String name = extractName(registrationId, attributes);
        if (name == null || name.isBlank()) {
            name = email;
        }

        String imageUrl = extractImage(registrationId, attributes);
        String providerId = extractProviderId(registrationId, attributes);

        AuthProvider provider = AuthProvider.valueOf(registrationId.toUpperCase());

        Optional<User> existingOpt = userRepository.findByEmail(email);
        User user;
        if (existingOpt.isPresent()) {
            user = existingOpt.get();
            if (!user.getProvider().equals(provider)) {
                log.info("User with email {} exists with provider {} but is logging in via {}. Keeping original provider.",
                        email, user.getProvider(), provider);
            }
            // always update mutable fields
            user.setName(name);

            boolean hasLocalImage = imageService.findLocalProfileImagePath(user.getId()) != null;
            if (!hasLocalImage && imageUrl != null && !imageUrl.isBlank()) {
                // Only overwrite avatar from provider if no local uploaded image exists
                user.setImageUrl(imageUrl);
            }
        } else {
            user = registerNewUser(provider, providerId, name, email, imageUrl);
            log.info("Registered new OAuth2 user: {} via {}", email, provider);
        }

        userRepository.save(user);
        userSyncNotifier.notifyUpsert(user);
        return oAuth2User;
    }

    private User registerNewUser(AuthProvider provider, String providerId, String name, String email, String imageUrl) {
        return userRepository.save(User.builder()
                .provider(provider)
                .providerId(providerId)
                .name(name)
                .email(email)
                .imageUrl(imageUrl)
                .emailVerified(true)
                .role(Role.USER)
                .build());
    }

    private String extractEmail(String provider, Map<String, Object> attrs, OAuth2UserRequest request) {
        if ("google".equalsIgnoreCase(provider)) {
            return (String) attrs.get("email");
        } else if ("github".equalsIgnoreCase(provider)) {
            String email = (String) attrs.get("email");
            if (email != null && !email.isBlank()) {
                return email;
            }
            return fetchGithubPrimaryEmail(request);
        }
        return null;
    }

    private String extractName(String provider, Map<String, Object> attrs) {
        if ("google".equalsIgnoreCase(provider)) {
            return (String) attrs.get("name");
        } else if ("github".equalsIgnoreCase(provider)) {
            Object name = attrs.get("name");
            if (name instanceof String && !((String) name).isBlank()) {
                return (String) name;
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

    private String fetchGithubPrimaryEmail(OAuth2UserRequest request) {
        String token = request.getAccessToken().getTokenValue();
        RestTemplate rest = new RestTemplate();

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "token " + token);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        HttpEntity<Void> entity = new HttpEntity<>(headers);

        try {
            ResponseEntity<List<Map<String, Object>>> resp = rest.exchange(
                    "https://api.github.com/user/emails",
                    HttpMethod.GET,
                    entity,
                    new ParameterizedTypeReference<>() {}
            );

            List<Map<String, Object>> emails = resp.getBody();
            if (emails == null) return null;

            for (Map<String, Object> e : emails) {
                Boolean primary = (Boolean) e.get("primary");
                Boolean verified = (Boolean) e.get("verified");
                String email = (String) e.get("email");
                if (Boolean.TRUE.equals(primary) && Boolean.TRUE.equals(verified) && email != null) {
                    return email;
                }
            }
            for (Map<String, Object> e : emails) {
                Boolean verified = (Boolean) e.get("verified");
                String email = (String) e.get("email");
                if (Boolean.TRUE.equals(verified) && email != null) {
                    return email;
                }
            }
        } catch (RestClientException ex) {
            log.warn("Failed to fetch GitHub emails: {}", ex.getMessage());
        }
        return null;
    }
}
