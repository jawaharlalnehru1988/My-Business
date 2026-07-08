package com.company.accounting.domain.purchase.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class PurchaseOrderItemRequest {
    private Long productId;
    private BigDecimal quantity;
    private BigDecimal unitPrice;
    private BigDecimal taxPercentage;
}
