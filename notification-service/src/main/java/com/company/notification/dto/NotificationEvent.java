package com.company.notification.dto;

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
    private String transactionId; // Invoice Number
    private BigDecimal totalAmount;
    private String recipientEmail; // e.g. "admin@accounting.com"
    private LocalDateTime timestamp;
}
