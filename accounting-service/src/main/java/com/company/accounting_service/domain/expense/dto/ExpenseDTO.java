package com.company.accounting_service.domain.expense.dto;

import com.company.accounting_service.core.json.ExtensibleDTO;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = false)
public class ExpenseDTO extends ExtensibleDTO {
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
