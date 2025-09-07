package com.ai.group.Artificial.nlp.dto;

import java.util.UUID;

public record ClassificationRequest(
        UUID userId,
        String message
) { }
