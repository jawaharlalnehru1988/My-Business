package com.company.inventory_service.kafka.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryResultEvent {
    private String transactionId; // Corresponds to SaleOrder invoiceNumber
    private String status; // SUCCESS or FAILED
    private String message; // Error details if failed
    private Long tenantId;
}


