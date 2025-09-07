package com.spark.electronics_store.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RejectBrandRequestDto {
    private String reason;
}
