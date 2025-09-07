package com.spark.electronics_store.dto.order;

import lombok.*;
import java.math.BigDecimal;
import java.util.UUID;

@Getter @Setter
@NoArgsConstructor @AllArgsConstructor @Builder
public class OrderItemDto {
    private UUID id;
    private UUID productId;
    private String productName;
    private BigDecimal unitPrice;
    private Integer qty;
    private String currency;
    private String createdAt; // ISO string
}
