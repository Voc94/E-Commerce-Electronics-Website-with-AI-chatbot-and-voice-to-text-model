// src/main/java/com/spark/demo/service/UserImageService.java
package com.spark.demo.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.nio.file.*;
import java.util.Objects;
import java.util.UUID;

@Service
public class UserImageService {

    @Value("${upload.base-dir}")
    private String baseDir;

    private static final long MAX_SIZE = 2 * 1024 * 1024; // 2MB

    public void storeProfileImage(MultipartFile file, UUID userId) throws Exception {
        String contentType = file.getContentType();
        if (contentType == null) {
            throw new IllegalArgumentException("Missing content type");
        }

        boolean isPng = contentType.equalsIgnoreCase("image/png");
        boolean isJpeg = contentType.equalsIgnoreCase("image/jpeg") || contentType.equalsIgnoreCase("image/jpg");
        if (!isPng && !isJpeg) {
            throw new IllegalArgumentException("Only PNG/JPEG allowed");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new IllegalArgumentException("File too large (max 2MB)");
        }

        String ext = isPng ? ".png" : ".jpg";

        Path dir = Paths.get(Objects.requireNonNull(baseDir)).toAbsolutePath().normalize();
        Files.createDirectories(dir);

        // Clean up other format if replacing
        Path png = dir.resolve("user-" + userId + ".png");
        Path jpg = dir.resolve("user-" + userId + ".jpg");
        if (isPng && Files.exists(jpg)) {
            Files.deleteIfExists(jpg);
        }
        if (!isPng && Files.exists(png)) {
            Files.deleteIfExists(png);
        }

        Path target = dir.resolve("user-" + userId + ext);
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    /**
     * Helper for controller to find the stored local image path if any.
     * Returns null if none exists.
     */
    public Path findLocalProfileImagePath(UUID userId) {
        Path dir = Paths.get(Objects.requireNonNull(baseDir)).toAbsolutePath().normalize();
        Path png = dir.resolve("user-" + userId + ".png");
        if (Files.exists(png)) return png;
        Path jpg = dir.resolve("user-" + userId + ".jpg");
        if (Files.exists(jpg)) return jpg;
        return null;
    }
}
