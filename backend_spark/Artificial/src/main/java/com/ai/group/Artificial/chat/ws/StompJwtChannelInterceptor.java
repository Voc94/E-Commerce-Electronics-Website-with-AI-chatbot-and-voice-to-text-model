// src/main/java/com/ai/group/Artificial/chat/ws/StompJwtChannelInterceptor.java
package com.ai.group.Artificial.chat.ws;

import com.ai.group.Artificial.chat.service.UserDirectoryService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.util.StringUtils;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

public class StompJwtChannelInterceptor implements ChannelInterceptor {

    private final JwtDecoder jwtDecoder;
    private final UserDirectoryService users;

    public StompJwtChannelInterceptor(JwtDecoder jwtDecoder, UserDirectoryService users) {
        this.jwtDecoder = jwtDecoder;
        this.users = users;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor acc = StompHeaderAccessor.wrap(message);

        if (StompCommand.CONNECT.equals(acc.getCommand())) {
            // 1) Try Authorization header (or lowercase)
            String auth = first(acc, "Authorization");
            if (!StringUtils.hasText(auth)) auth = first(acc, "authorization");

            // 2) Or access_token / token
            if (!StringUtils.hasText(auth)) {
                String tok = first(acc, "access_token");
                if (!StringUtils.hasText(tok)) tok = first(acc, "token");
                if (StringUtils.hasText(tok)) auth = tok.startsWith("Bearer ") ? tok : "Bearer " + tok;
            }

            if (StringUtils.hasText(auth) && auth.startsWith("Bearer ")) {
                String token = auth.substring(7).trim();
                try {
                    Jwt jwt = jwtDecoder.decode(token);

                    // Prefer UUID claims if present
                    UUID id = tryUuid(claim(jwt, "id"));
                    if (id == null) id = tryUuid(claim(jwt, "sub"));
                    if (id == null) id = tryUuid(claim(jwt, "userId"));
                    if (id == null) id = tryUuid(claim(jwt, "uid"));

                    String email = claim(jwt, "email");
                    String subject = claim(jwt, "sub");

                    // If still no UUID, resolve from DB by email / subject
                    if (id == null && StringUtils.hasText(email)) {
                        id = users.findIdByEmail(email).orElse(null);
                    }
                    if (id == null && StringUtils.hasText(subject)) {
                        id = users.findIdByUsernameOrEmail(subject).orElse(null);
                    }

                    // Only attach a Principal if we have a UUID – user destinations depend on it
                    if (id != null) {
                        Principal p = new WsPrincipal(id, email);
                        acc.setUser(p);
                    }
                } catch (Exception ignore) {
                    // Leave user null; controller will reject
                }
            }
        }

        return message;
    }

    private static String first(StompHeaderAccessor acc, String name) {
        List<String> vals = acc.getNativeHeader(name);
        return (vals != null && !vals.isEmpty()) ? vals.get(0) : null;
    }

    private static String claim(Jwt jwt, String name) {
        Object v = jwt.getClaims().get(name);
        return v != null ? v.toString() : null;
    }

    private static UUID tryUuid(String s) {
        if (!StringUtils.hasText(s)) return null;
        try { return UUID.fromString(s); } catch (Exception e) { return null; }
    }
}
