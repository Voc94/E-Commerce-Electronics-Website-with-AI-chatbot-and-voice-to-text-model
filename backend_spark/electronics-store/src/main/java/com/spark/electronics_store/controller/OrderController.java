// src/main/java/com/spark/electronics_store/controller/OrderController.java
package com.spark.electronics_store.controller;

import com.spark.electronics_store.dto.order.OrderCreateRequest;
import com.spark.electronics_store.dto.order.OrderDto;
import com.spark.electronics_store.mapper.OrderDtoMapper;
import com.spark.electronics_store.model.Order;
import com.spark.electronics_store.model.Role;
import com.spark.electronics_store.model.UserSync;
import com.spark.electronics_store.repository.ProductRepository;
import com.spark.electronics_store.repository.UserSyncRepository;
import com.spark.electronics_store.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/orders")
@RequiredArgsConstructor
@CrossOrigin(
        origins = {"http://localhost:3000", "http://localhost:5173"},
        allowCredentials = "true",
        allowedHeaders = {"Authorization", "Content-Type"},
        methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS}
)
public class OrderController {

    private final OrderService orderService;
    private final UserSyncRepository userSyncRepository;
    private final ProductRepository productRepository;
    private final OrderDtoMapper mapper;

    @PostMapping
    public ResponseEntity<OrderDto> create(@RequestBody OrderCreateRequest req,
                                           @AuthenticationPrincipal Jwt jwt) {
        UUID buyerId = resolveBuyerId(jwt)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
        req.setBuyerId(buyerId);
        Order created = orderService.create(req);
        return ResponseEntity.ok(mapper.toDto(created));
    }

    @GetMapping("/buyer/{buyerId}")
    public ResponseEntity<List<OrderDto>> byBuyer(@PathVariable UUID buyerId) {
        var list = orderService.listByBuyer(buyerId).stream().map(mapper::toDto).toList();
        return ResponseEntity.ok(list);
    }

    /** NEW: brand-facing orders (items filtered to the brand, totals recomputed) */
    @GetMapping("/brand/{brandId}")
    public ResponseEntity<List<OrderDto>> byBrand(@PathVariable UUID brandId,
                                                  @AuthenticationPrincipal Jwt jwt) {
        // authn / authz: must be BRAND_SELLER of this brand
        UUID caller = resolveBuyerId(jwt)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized"));
        UserSync user = userSyncRepository.findById(caller)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        if (user.isDeleted() || user.getRole() != Role.BRAND_SELLER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only brand sellers can view brand orders");
        }
        if (user.getBrand() == null || !brandId.equals(user.getBrand().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Brand mismatch");
        }

        // gather product ids for this brand
        var productIds = productRepository.findAllByBrandIdAndDeletedFalse(brandId).stream()
                .map(p -> p.getId())
                .collect(Collectors.toSet());

        if (productIds.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        // fetch orders that contain any of this brand's products
        var orders = orderService.listByBrand(brandId);

        // map to brand-sliced DTOs
        var dtos = orders.stream()
                .map(o -> mapper.toBrandSliceDto(o, productIds))
                .filter(dto -> dto.getItems() != null && !dto.getItems().isEmpty())
                .toList();

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderDto> get(@PathVariable UUID id) {
        return orderService.get(id)
                .map(o -> ResponseEntity.ok(mapper.toDto(o)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private Optional<UUID> resolveBuyerId(Jwt jwt) {
        if (jwt == null) return Optional.empty();

        String uid = jwt.getClaimAsString("uid");
        if (uid != null) {
            try { return Optional.of(UUID.fromString(uid)); } catch (IllegalArgumentException ignored) {}
        }
        String sub = jwt.getSubject();
        if (sub != null) {
            try { return Optional.of(UUID.fromString(sub)); } catch (IllegalArgumentException ignored) {}
            return userSyncRepository.findByEmailIgnoreCase(sub).map(UserSync::getId);
        }
        return Optional.empty();
    }
}
