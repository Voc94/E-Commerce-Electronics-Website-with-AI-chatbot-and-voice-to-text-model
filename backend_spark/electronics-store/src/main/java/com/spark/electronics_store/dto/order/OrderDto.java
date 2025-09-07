package com.spark.electronics_store.dto.order;

import com.spark.electronics_store.model.OrderStatus;
import lombok.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class OrderDto {
    private UUID id;

    // monetary
    private BigDecimal subtotal;
    private BigDecimal shipping;
    private BigDecimal tax;
    private BigDecimal total;
    private String currency;

    // status & timestamps
    private OrderStatus status;
    private String createdAt; // ISO
    private String updatedAt; // ISO

    // shipping snapshot
    private String fullName;
    private String email;
    private String address;
    private String city;
    private String zip;
    private String country;

    // items
    private List<OrderItemDto> items;
}
