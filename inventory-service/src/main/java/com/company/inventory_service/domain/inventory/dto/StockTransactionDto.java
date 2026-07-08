package com.company.inventory_service.domain.inventory.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class StockTransactionDto {
    private Long id;
    private ProductInfo product;
    private WarehouseInfo warehouse;
    private BigDecimal quantity;
    private String transactionType;
    private LocalDateTime createdAt;

    @Data
    @Builder
    public static class ProductInfo {
        private Long id;
        private String name;
    }

    @Data
    @Builder
    public static class WarehouseInfo {
        private Long id;
        private String name;
    }
}
