package com.company.accounting.domain.sales.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class SaleOrderItemRequest {
    private Long productId;
    private BigDecimal quantity;
    private BigDecimal unitPrice;
}
