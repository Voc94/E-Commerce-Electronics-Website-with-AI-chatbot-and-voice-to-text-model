package com.ai.group.Artificial.nlp;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;

final class Vocab {

    private final Map<String, Integer> map;
    private final int padId;
    private final int unkId;
    private final String padToken;
    private final String unkToken;

    private Vocab(Map<String, Integer> map, String padToken, String unkToken) {
        this.map = map;
        this.padToken = padToken;
        this.unkToken = unkToken;

        this.padId = map.getOrDefault(padToken, 0);
        this.unkId = map.getOrDefault(unkToken, padId); // fall back to PAD if no UNK
    }

    static Vocab load(Path jsonPath, String padToken, String unkToken) throws java.io.IOException {
        try (InputStream in = Files.newInputStream(jsonPath)) {
            ObjectMapper om = new ObjectMapper();
            Map<String, Integer> m = om.readValue(in, new TypeReference<>() {});
            return new Vocab(m, padToken, unkToken);
        }
    }

    int padId() { return padId; }

    int idOrUnk(String token) {
        Integer v = map.get(token);
        if (v != null) return v;

        // Try a few sane fallbacks (depends on how the vocab was built)
        v = map.get(token.toLowerCase(Locale.ROOT));
        if (v != null) return v;

        v = map.get(token.replaceAll("\\d", "0")); // number normalization
        if (v != null) return v;

        return unkId;
    }
}
