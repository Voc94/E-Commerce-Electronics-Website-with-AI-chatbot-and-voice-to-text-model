package com.spark.electronics_store.model;


import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class Order {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "buyer_id", nullable = false)
    private UserSync buyer;

    @Column(precision = 18, scale = 2)
    private BigDecimal subtotal;

    @Column(precision = 18, scale = 2)
    private BigDecimal shipping; // keep 0 for now

    @Column(precision = 18, scale = 2)
    private BigDecimal tax; // keep 0 / included

    @Column(precision = 18, scale = 2)
    private BigDecimal total;

    private String currency; // e.g., "RON"

    @Enumerated(EnumType.STRING)
    private OrderStatus status;

    // Shipping snapshot (copied at order time)
    private String fullName;
    private String email;
    private String address;
    private String city;
    private String zip;
    private String country;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("createdAt ASC")
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;
}
