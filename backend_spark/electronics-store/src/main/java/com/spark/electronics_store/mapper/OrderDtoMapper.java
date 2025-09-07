package com.spark.electronics_store.mapper;

import com.spark.electronics_store.dto.order.OrderDto;
import com.spark.electronics_store.dto.order.OrderItemDto;
import com.spark.electronics_store.model.Order;
import com.spark.electronics_store.model.OrderItem;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Component
public class OrderDtoMapper {

    public OrderDto toDto(Order o) {
        if (o == null) return null;

        List<OrderItem> srcItems = (o.getItems() == null) ? List.of() : o.getItems();
        List<OrderItemDto> items = srcItems.stream().map(this::toDto).toList();

        return OrderDto.builder()
                .id(o.getId())
                .subtotal(o.getSubtotal())
                .shipping(o.getShipping())
                .tax(o.getTax())
                .total(o.getTotal())
                .currency(o.getCurrency())
                .status(o.getStatus())
                .createdAt(o.getCreatedAt() != null ? o.getCreatedAt().toString() : null)
                .updatedAt(o.getUpdatedAt() != null ? o.getUpdatedAt().toString() : null)
                .fullName(o.getFullName())
                .email(o.getEmail())
                .address(o.getAddress())
                .city(o.getCity())
                .zip(o.getZip())
                .country(o.getCountry())
                .items(items)
                .build();
    }

    private OrderItemDto toDto(OrderItem it) {
        if (it == null) return null;
        return OrderItemDto.builder()
                .id(it.getId())
                .productId(it.getProductId())
                .productName(it.getProductName())
                .unitPrice(it.getUnitPrice())
                .qty(it.getQty())
                .currency(it.getCurrency())
                .createdAt(it.getCreatedAt() != null ? it.getCreatedAt().toString() : null)
                .build();
    }

    /** Brand slice: keep only items with productId ∈ allowedProductIds and recompute totals. */
    public OrderDto toBrandSliceDto(Order o, Set<UUID> allowedProductIds) {
        if (o == null) return null;

        List<OrderItem> allItems = (o.getItems() == null) ? List.of() : o.getItems();
        List<OrderItem> filtered = allItems.stream()
                .filter(it -> it.getProductId() != null && allowedProductIds.contains(it.getProductId()))
                .toList();

        List<OrderItemDto> itemDtos = filtered.stream()
                .map(it -> OrderItemDto.builder()
                        .id(it.getId())
                        .productId(it.getProductId())
                        .productName(it.getProductName())
                        .unitPrice(it.getUnitPrice())
                        .qty(it.getQty())
                        .currency(it.getCurrency())
                        .createdAt(it.getCreatedAt() != null ? it.getCreatedAt().toString() : null)
                        .build())
                .toList();

        BigDecimal subtotal = filtered.stream()
                .map(it -> (it.getUnitPrice() == null ? BigDecimal.ZERO : it.getUnitPrice())
                        .multiply(BigDecimal.valueOf(it.getQty() == null ? 1 : it.getQty())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Brand slice: simplest is zero for shipping/tax; adjust if you later pro-rate.
        BigDecimal shipping = BigDecimal.ZERO;
        BigDecimal tax = BigDecimal.ZERO;
        BigDecimal total = subtotal.add(shipping).add(tax);

        return OrderDto.builder()
                .id(o.getId())
                .currency(o.getCurrency())
                .subtotal(subtotal)
                .shipping(shipping)
                .tax(tax)
                .total(total)
                .status(o.getStatus())
                .fullName(o.getFullName())
                .email(o.getEmail())
                .address(o.getAddress())
                .city(o.getCity())
                .zip(o.getZip())
                .country(o.getCountry())
                .createdAt(o.getCreatedAt() != null ? o.getCreatedAt().toString() : null)
                .updatedAt(o.getUpdatedAt() != null ? o.getUpdatedAt().toString() : null)
                .items(itemDtos)
                .build();
    }
}
