package com.company.inventory_service.kafka.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryEvent {
    private String transactionId; // e.g. SaleOrder invoiceNumber
    private String eventType; // e.g. DEDUCT_STOCK
    private Long tenantId;
    private List<StockItem> items;
    private Long warehouseId;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StockItem {
        private Long productId;
        private BigDecimal quantity;
    }
}


