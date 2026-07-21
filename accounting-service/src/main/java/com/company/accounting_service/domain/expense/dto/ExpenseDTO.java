package com.company.accounting_service.domain.expense.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ExpenseDTO {
    private Long id;
    private LocalDate date;
    private String description;
    private String category;
    private BigDecimal amount;
    private BigDecimal gstAmount;
    private BigDecimal gstPercent;
    private Boolean interstate;
    private String vendorName;
    private String vendorGstin;
    private String invoiceNo;
    private String paymentMode;
    private String note;
}
