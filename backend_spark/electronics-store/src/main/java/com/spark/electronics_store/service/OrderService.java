package com.spark.electronics_store.service;

import com.spark.electronics_store.dto.order.OrderCreateRequest;
import com.spark.electronics_store.model.Order;
import com.spark.electronics_store.model.OrderItem;
import com.spark.electronics_store.model.OrderStatus;
import com.spark.electronics_store.model.Product;
import com.spark.electronics_store.model.UserSync;
import com.spark.electronics_store.repository.OrderRepository;
import com.spark.electronics_store.repository.ProductRepository;
import com.spark.electronics_store.repository.UserSyncRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private final OrderRepository orderRepo;
    private final ProductRepository productRepository;
    private final UserSyncRepository userSyncRepository;

    @Transactional
    public Order create(OrderCreateRequest req) {
        if (req == null) throw new IllegalArgumentException("Request is null");
        if (req.getBuyerId() == null) throw new IllegalArgumentException("BuyerId is required");
        if (req.getItems() == null || req.getItems().isEmpty()) {
            throw new IllegalArgumentException("No items provided");
        }

        // Resolve buyer
        UserSync buyer = userSyncRepository.findById(req.getBuyerId())
                .orElseThrow(() -> new IllegalArgumentException("Buyer not found: " + req.getBuyerId()));

        // Load products we need
        List<UUID> productIds = req.getItems().stream()
                .map(OrderCreateRequest.Item::getProductId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (productIds.isEmpty()) throw new IllegalArgumentException("No productIds provided");

        Map<UUID, Product> productMap = productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(Product::getId, p -> p));

        // Create order shell
        Order order = new Order();
        order.setId(UUID.randomUUID());
        order.setBuyer(buyer);

        // Shipping snapshot (map request -> model field names)
        order.setFullName(req.getShippingName());
        order.setEmail(req.getShippingEmail());
        order.setAddress(req.getShippingAddress());
        order.setCity(req.getShippingCity());
        order.setZip(req.getShippingZip());
        order.setCountry(req.getShippingCountry());

        // Currency: prefer request, else first product currency, else RON
        order.setCurrency(resolveCurrency(req.getCurrency(), productMap.values()));

        // Build lines
        List<OrderItem> lines = new ArrayList<>();

        for (OrderCreateRequest.Item it : req.getItems()) {
            UUID pid = it.getProductId();
            if (pid == null) {
                log.warn("Skipping item with null productId");
                continue;
            }
            Product p = productMap.get(pid);
            if (p == null) {
                log.warn("Order item product not found: {}", pid);
                continue;
            }

            int qty = Math.max(1, it.getQuantity());
            BigDecimal unit = it.getPriceAtPurchase();
            if (unit == null) unit = p.getPrice();
            if (unit == null) unit = BigDecimal.ZERO;

            BigDecimal lineTotal = unit.multiply(BigDecimal.valueOf(qty))
                    .setScale(2, RoundingMode.HALF_UP);

            OrderItem line = new OrderItem();
            line.setId(UUID.randomUUID());
            line.setOrder(order);
            line.setProductId(p.getId());         // snapshot reference
            line.setProductName(p.getName());     // snapshot name
            line.setUnitPrice(unit.setScale(2, RoundingMode.HALF_UP));
            line.setQty(qty);
            line.setCurrency(order.getCurrency()); // snapshot currency (same as order)

            lines.add(line);
        }

        if (lines.isEmpty()) {
            throw new IllegalArgumentException("No valid items");
        }

        // Totals
        BigDecimal subtotal = lines.stream()
                .map(li -> li.getUnitPrice().multiply(BigDecimal.valueOf(li.getQty())))
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        order.setItems(lines);           // cascade saves items
        order.setSubtotal(subtotal);
        order.setShipping(BigDecimal.ZERO);
        order.setTax(BigDecimal.ZERO);
        order.setTotal(subtotal);
        // Optional: set an initial status if you use it
        try {
            order.setStatus(OrderStatus.PENDING);
        } catch (Throwable ignore) {
            // if enum/value not present, leave null
        }

        return orderRepo.save(order);
    }

    public List<Order> listByBuyer(UUID buyerId) {
        return orderRepo.findByBuyer_IdOrderByCreatedAtDesc(buyerId);
    }

    public Optional<Order> get(UUID id) {
        return orderRepo.findById(id);
    }

    private String resolveCurrency(String requested, Collection<Product> products) {
        if (requested != null && !requested.isBlank()) return requested;
        for (Product p : products) {
            if (p.getCurrency() != null && !p.getCurrency().isBlank()) return p.getCurrency();
        }
        return "RON";
    }
    public List<Order> listByBrand(UUID brandId) {
        var brandProducts = productRepository.findAllByBrandIdAndDeletedFalse(brandId);
        if (brandProducts == null || brandProducts.isEmpty()) {
            return List.of();
        }
        var productIds = brandProducts.stream()
                .map(p -> p.getId())
                .collect(Collectors.toSet());
        return orderRepo.findDistinctByItemsProductIds(productIds);
    }
}
