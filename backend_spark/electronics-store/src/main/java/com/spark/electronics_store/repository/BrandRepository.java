package com.spark.electronics_store.repository;

import com.spark.electronics_store.model.Brand;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BrandRepository extends JpaRepository<Brand, UUID> {
    Optional<Brand> findBySlug(String slug);
    List<Brand> findByNameContainingIgnoreCaseOrSlugContainingIgnoreCase(String name, String slug);

    boolean existsBySlugIgnoreCase(String slug);
    boolean existsByNameIgnoreCase(String name);
}