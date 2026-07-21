package com.company.accounting_service.domain.receipt.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ReceiptDTO {
    private Long id;
    private LocalDate date;
    private String receiptNo;
    private String clientName;
    private String clientAddress;
    private BigDecimal amount;
    private String paymentMode;
    private String referenceNo;
    private String againstInvoice;
    private String note;
}
