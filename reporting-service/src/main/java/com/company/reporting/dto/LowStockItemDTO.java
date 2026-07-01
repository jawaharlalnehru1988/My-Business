package com.company.reporting.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class LowStockItemDTO {
    private String productName;
    private String sku;
    private BigDecimal currentStock;
    private BigDecimal minimumStock;
}
