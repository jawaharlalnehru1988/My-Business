package com.company.accounting_service.domain.invoice.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class InvoiceLineItemDTO {
    private Long id;
    private Long productId;
    private String name;
    private String hsn;
    private BigDecimal quantity;
    private BigDecimal rate;
    private BigDecimal taxPercent;
    private BigDecimal discount;
    private BigDecimal amount;
}
