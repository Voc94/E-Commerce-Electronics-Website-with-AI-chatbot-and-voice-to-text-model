package com.spark.electronics_store.model;


import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_items")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class OrderItem {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    @JsonIgnore
    private Order order;

    // We only store the reference + a snapshot (name/price/currency)
    @Column(name = "product_id", nullable = false, columnDefinition = "uuid")
    private UUID productId;

    private String productName;

    @Column(precision = 18, scale = 2)
    private BigDecimal unitPrice;

    private Integer qty;

    private String currency;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;
}
