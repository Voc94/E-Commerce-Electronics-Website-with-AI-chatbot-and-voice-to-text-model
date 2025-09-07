// src/main/java/com/ai/group/Artificial/chat/ws/WebSocketSecurityConfig.java
package com.ai.group.Artificial.chat.ws;

import com.ai.group.Artificial.chat.service.UserDirectoryService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.oauth2.jwt.JwtDecoder;

@Configuration
public class WebSocketSecurityConfig {

    // Give this bean a distinct name we can @Qualifier by
    @Bean(name = "stompJwtChannelInterceptor")
    public ChannelInterceptor stompJwtChannelInterceptor(JwtDecoder jwtDecoder,
                                                         UserDirectoryService users) {
        return new StompJwtChannelInterceptor(jwtDecoder, users);
    }
}
