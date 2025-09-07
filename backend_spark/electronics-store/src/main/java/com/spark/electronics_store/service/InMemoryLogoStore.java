package com.spark.electronics_store.service;

import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class InMemoryLogoStore {

    public static final class StoredLogo {
        public final byte[] bytes;
        public final String contentType;

        public StoredLogo(byte[] bytes, String contentType) {
            this.bytes = bytes;
            this.contentType = (contentType == null || contentType.isBlank())
                    ? "application/octet-stream" : contentType;
        }
    }

    private final ConcurrentHashMap<UUID, StoredLogo> store = new ConcurrentHashMap<>();

    public void put(UUID requestId, byte[] bytes, String contentType) {
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("Empty file");
        }
        store.put(requestId, new StoredLogo(bytes, contentType));
    }

    public Optional<StoredLogo> get(UUID requestId) {
        return Optional.ofNullable(store.get(requestId));
    }

    public void delete(UUID requestId) {
        store.remove(requestId);
    }
}
