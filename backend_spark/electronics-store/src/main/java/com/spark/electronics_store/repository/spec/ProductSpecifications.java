// src/main/java/com/spark/electronics_store/repository/spec/ProductSpecifications.java
package com.spark.electronics_store.repository.spec;

import com.spark.electronics_store.model.Product;
import com.spark.electronics_store.model.ProductCategory;
import com.spark.electronics_store.model.ProductStatus;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;

public final class ProductSpecifications {

    private ProductSpecifications() {}

    public static Specification<Product> notDeleted() {
        return (root, q, cb) -> cb.isFalse(root.get("deleted"));
    }

    public static Specification<Product> statusActive() {
        return (root, q, cb) -> cb.equal(root.get("status"), ProductStatus.ACTIVE);
    }

    public static Specification<Product> queryLike(String query) {
        if (query == null) return null;
        String trimmed = query.trim();
        if (trimmed.isEmpty()) return null;

        String[] tokens = trimmed.toLowerCase().split("\\s+");

        return (root, q, cb) -> {
            // LEFT JOIN brand so we can search brand.name as well
            var brandJoin = root.join("brand", jakarta.persistence.criteria.JoinType.LEFT);

            var nameExpr = cb.lower(root.get("name"));
            var descExpr = cb.lower(root.get("description"));
            var slugExpr = cb.lower(root.get("slug"));
            var brandNameExpr = cb.lower(brandJoin.get("name"));

            var predicate = cb.conjunction();
            for (String t : tokens) {
                String like = "%" + t + "%";
                predicate = cb.and(predicate, cb.or(
                        cb.like(nameExpr, like),
                        cb.like(cb.coalesce(descExpr, ""), like),
                        cb.like(cb.coalesce(slugExpr, ""), like),
                        cb.like(cb.coalesce(brandNameExpr, ""), like)
                ));
            }
            return predicate;
        };
    }

    public static Specification<Product> categoryEq(ProductCategory category) {
        if (category == null) return null;
        return (root, q, cb) -> cb.equal(root.get("category"), category);
    }

    public static Specification<Product> priceGte(BigDecimal minPrice) {
        if (minPrice == null) return null;
        return (root, q, cb) -> cb.greaterThanOrEqualTo(root.get("price"), minPrice);
    }

    // Dacă vrei și preț maxim, ai asta pregătită:
    public static Specification<Product> priceLte(BigDecimal maxPrice) {
        if (maxPrice == null) return null;
        return (root, q, cb) -> cb.lessThanOrEqualTo(root.get("price"), maxPrice);
    }
}
