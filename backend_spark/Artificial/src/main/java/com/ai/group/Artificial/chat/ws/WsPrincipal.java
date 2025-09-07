// src/main/java/com/ai/group/Artificial/chat/ws/WsPrincipal.java
package com.ai.group.Artificial.chat.ws;

import java.security.Principal;
import java.util.UUID;

public record WsPrincipal(UUID id, String email) implements Principal {
    @Override public String getName() {
        return id != null ? id.toString() : (email != null ? email : "anonymous");
    }
}
