// src/main/java/com/ai/group/Artificial/security/stomp/JwtStompAuthChannelInterceptor.java
package com.ai.group.Artificial.security.stomp;

import com.ai.group.Artificial.chat.service.UserDirectoryService;
import com.ai.group.Artificial.chat.ws.WsPrincipal;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

@Component
@Slf4j
public class JwtStompAuthChannelInterceptor implements ChannelInterceptor {

    private final JwtDecoder jwtDecoder;
    private final UserDirectoryService users;

    public JwtStompAuthChannelInterceptor(JwtDecoder jwtDecoder, UserDirectoryService users) {
        this.jwtDecoder = jwtDecoder;
        this.users = users;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor acc = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (acc == null) return message;

        if (StompCommand.CONNECT.equals(acc.getCommand())) {
            String auth = first(acc, "Authorization");
            if (!StringUtils.hasText(auth)) auth = first(acc, "authorization");

            if (!StringUtils.hasText(auth)) {
                String tok = first(acc, "access_token");
                if (!StringUtils.hasText(tok)) tok = first(acc, "token");
                if (StringUtils.hasText(tok)) auth = tok.startsWith("Bearer ") ? tok : "Bearer " + tok;
            }

            if (StringUtils.hasText(auth) && auth.startsWith("Bearer ")) {
                String token = auth.substring(7).trim();
                try {
                    Jwt jwt = jwtDecoder.decode(token);

                    UUID id = resolveUuid(jwt);
                    String email = str(jwt, "email");

                    if (id != null) {
                        Principal p = new WsPrincipal(id, email);
                        acc.setUser(p);
                        log.debug("STOMP CONNECT -> principal set: id={}, email={}", id, email);
                    } else {
                        log.warn("STOMP CONNECT -> could not resolve UUID. sub={}, email={}", jwt.getSubject(), email);
                    }
                } catch (Exception e) {
                    log.warn("STOMP CONNECT -> JWT decode failed: {}", e.toString());
                }
            }
        }
        return message;
    }

    private static String first(StompHeaderAccessor acc, String name) {
        List<String> vals = acc.getNativeHeader(name);
        return (vals != null && !vals.isEmpty()) ? vals.get(0) : null;
    }

    private static String str(Jwt jwt, String claim) {
        Object v = jwt.getClaims().get(claim);
        return v != null ? v.toString() : null;
    }

    private UUID resolveUuid(Jwt jwt) {
        // Try direct UUID claims first
        for (String k : new String[]{"id", "sub", "userId", "uid"}) {
            String v = str(jwt, k);
            if (StringUtils.hasText(v)) {
                try { return UUID.fromString(v); } catch (Exception ignore) {}
            }
        }
        // Fallbacks via DB
        String email = str(jwt, "email");
        if (StringUtils.hasText(email)) {
            var id = users.findIdByEmail(email).orElse(null);
            if (id != null) return id;
        }
        String sub = jwt.getSubject();
        if (StringUtils.hasText(sub)) {
            return users.findIdByUsernameOrEmail(sub).orElse(null);
        }
        return null;
    }
}
