package com.spark.electronics_store.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BrandRequestCreateDto {
    @NotBlank
    private String name;
    @NotBlank
    private String slug;
    private String logoUrl;
}
