package com.spark.electronics_store.repository;

import com.spark.electronics_store.model.UserSync;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface UserSyncRepository extends JpaRepository<UserSync, UUID> {
    Optional<UserSync> findByEmail(String email);
    Optional<UserSync> findByEmailIgnoreCase(String email);
    @Query("select u from UserSync u left join fetch u.brand where u.id = :id")
    Optional<UserSync> findWithBrandById(@Param("id") UUID id);

}