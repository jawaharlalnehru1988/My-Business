package com.company.accounting_service.kafka.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryResultEvent {
    private String transactionId; 
    private String status; // SUCCESS or FAILED
    private String message; 
    private java.math.BigDecimal totalCogs; 
    private Long tenantId;
}
