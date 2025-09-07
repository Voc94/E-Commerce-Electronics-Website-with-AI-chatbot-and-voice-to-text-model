// com/ai/group/Artificial/nlp/dto/ClassificationResponse.java
package com.ai.group.Artificial.nlp.dto;

import java.util.UUID;

public record ClassificationResponse(
        UUID userId,
        String message,
        String link,          // null unless HELP_CATEGORY
        boolean adminIssued   // true for HELP_ADMIN
) {}
