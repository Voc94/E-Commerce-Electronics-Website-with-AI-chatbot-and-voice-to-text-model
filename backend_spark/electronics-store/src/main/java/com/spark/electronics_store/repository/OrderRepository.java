package com.spark.electronics_store.repository;

import com.spark.electronics_store.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    List<Order> findByBuyer_IdOrderByCreatedAtDesc(UUID buyerId);

    @Query("""
        select distinct o
        from Order o
        join o.items i
        where i.productId in :productIds
        order by o.createdAt desc, o.id
    """)
    List<Order> findDistinctByItemsProductIds(
            @Param("productIds") Collection<UUID> productIds
    );
}
