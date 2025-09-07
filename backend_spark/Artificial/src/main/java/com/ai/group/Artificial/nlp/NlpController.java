    // src/main/java/com/ai/group/Artificial/nlp/NlpController.java
    package com.ai.group.Artificial.nlp;

    import com.ai.group.Artificial.nlp.dto.ClassificationRequest;
    import com.ai.group.Artificial.nlp.dto.ClassificationResponse;
    import com.ai.group.Artificial.chat.model.ChatUser;
    import com.ai.group.Artificial.chat.service.UserDirectoryService;
    import lombok.RequiredArgsConstructor;
    import org.springframework.security.core.Authentication;
    import org.springframework.security.core.userdetails.UserDetails;
    import org.springframework.security.oauth2.jwt.Jwt;
    import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
    import org.springframework.web.bind.annotation.*;

    import java.util.List;
    import java.util.Optional;
    import java.util.UUID;

    @RestController
    @RequestMapping("/nlp")
    @RequiredArgsConstructor
    public class NlpController {

        private final TextClassifier classifier;
        private final UserDirectoryService users;

        @PostMapping("/classify")
        public ClassificationResponse classify(@RequestBody ClassificationRequest req,
                                               Authentication auth) {
            UUID uid = resolveUserId(auth).orElse(null);
            // always trust server-side identity
            return classifier.classify(uid, req.message());
        }
    
        private Optional<UUID> resolveUserId(Authentication auth) {
            if (auth == null || !auth.isAuthenticated()) return Optional.empty();

            Object principal = auth.getPrincipal();

            if (principal instanceof ChatUser cu) {
                return Optional.ofNullable(cu.getId());
            }

            if (auth instanceof JwtAuthenticationToken jwtAuth) {
                Jwt jwt = jwtAuth.getToken();

                for (String claim : List.of("uid", "user_id", "id", "sub")) {
                    String v = jwt.getClaimAsString(claim);
                    UUID u = tryUuid(v);
                    if (u != null) return Optional.of(u);
                }

                String email = jwt.getClaimAsString("email");
                if (email != null) {
                    return users.findIdByEmail(email);  // ✅ fixed
                }
            }

            if (principal instanceof UserDetails ud) {
                return users.findIdByUsernameOrEmail(ud.getUsername());
            }

            if (principal instanceof String s) {
                return users.findIdByUsernameOrEmail(s);
            }

            return Optional.empty();
        }

        private static UUID tryUuid(String s) {
            try { return s == null ? null : UUID.fromString(s); }
            catch (Exception ignore) { return null; }
        }
    }
