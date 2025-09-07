// DTO for returning brand summary (if you don't already have one)
package com.spark.electronics_store.dto;

import lombok.*;

import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BrandSummaryResponse {
    private UUID id;
    private String name;
    private String slug;
    private String logoUrl;
}
