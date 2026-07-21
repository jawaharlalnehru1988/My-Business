package com.company.accounting_service.domain.invoice.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
public class InvoiceDTO {
    private Long id;
    private String invoiceNumber;
    private String type;
    private LocalDate invoiceDate;
    private LocalDate dueDate;
    private String clientName;
    private Long clientId;
    private BigDecimal subtotal;
    private BigDecimal cgstAmount;
    private BigDecimal sgstAmount;
    private BigDecimal igstAmount;
    private BigDecimal totalAmount;
    private String status;
    private String notes;
    private String terms;
    private Map<String, Object> options;
    private List<InvoiceLineItemDTO> items;
}
