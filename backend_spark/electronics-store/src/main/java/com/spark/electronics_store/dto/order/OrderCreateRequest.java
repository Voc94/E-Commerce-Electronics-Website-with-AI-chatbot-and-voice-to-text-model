// src/main/java/com/spark/electronics_store/dto/order/OrderCreateRequest.java
package com.spark.electronics_store.dto.order;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class OrderCreateRequest {

    @JsonProperty("buyerId")
    private UUID buyerId;

    @JsonProperty("items")
    private List<Item> items = new ArrayList<>();

    @JsonProperty("currency")
    private String currency;

    @JsonProperty("subtotal")
    private BigDecimal subtotal;

    @JsonProperty("total")
    private BigDecimal total;

    @JsonProperty("shippingName")
    private String shippingName;

    @JsonProperty("shippingEmail")
    private String shippingEmail;

    @JsonProperty("shippingAddress")
    private String shippingAddress;

    @JsonProperty("shippingCity")
    private String shippingCity;

    @JsonProperty("shippingZip")
    private String shippingZip;

    @JsonProperty("shippingCountry")
    private String shippingCountry;

    @Data
    public static class Item {
        @JsonProperty("productId")
        private UUID productId;

        @JsonProperty("quantity")
        private int quantity;

        @JsonProperty("priceAtPurchase")
        private BigDecimal priceAtPurchase;
    }
}
