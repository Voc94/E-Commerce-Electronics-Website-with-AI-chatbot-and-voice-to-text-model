package com.spark.electronics_store.repository;

import com.spark.electronics_store.model.ProductPhoto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProductPhotoRepository extends JpaRepository<ProductPhoto, UUID> {

    int countByProduct_Id(UUID productId);

    List<ProductPhoto> findByProduct_IdOrderByPositionAsc(UUID productId);
}
