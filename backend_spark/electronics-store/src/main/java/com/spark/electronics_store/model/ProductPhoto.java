package com.spark.electronics_store.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;

import java.sql.Types;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "product_photos")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductPhoto {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false)
    private String filename;

    @Column(nullable = false)
    private String contentType;

    @Lob
    @JdbcTypeCode(Types.BINARY) // Or Types.VARBINARY
    @Column(columnDefinition = "bytea", nullable = false)
    private byte[] data;

    @Column(nullable = false)
    private Integer position;

    @Column(name = "is_primary", nullable = false)
    private boolean primary;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
