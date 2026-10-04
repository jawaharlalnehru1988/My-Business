package com.company.accounting_service.domain.receipt.dto;

import com.company.accounting_service.core.json.ExtensibleDTO;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = false)
public class ReceiptDTO extends ExtensibleDTO {
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
