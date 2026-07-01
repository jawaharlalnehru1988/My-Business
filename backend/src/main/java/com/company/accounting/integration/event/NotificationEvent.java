package com.company.accounting.integration.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationEvent {
    private String eventType;
    private Long tenantId;
    private String transactionId; 
    private BigDecimal totalAmount;
    private String recipientEmail; 
    private LocalDateTime timestamp;
}
