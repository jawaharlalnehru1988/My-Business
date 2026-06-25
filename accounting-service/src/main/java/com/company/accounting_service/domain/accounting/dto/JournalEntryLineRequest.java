package com.company.accounting_service.domain.accounting.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class JournalEntryLineRequest {
    
        private Long ledgerId;
    private String ledgerName;
    
    private BigDecimal debitAmount = BigDecimal.ZERO;
    private BigDecimal creditAmount = BigDecimal.ZERO;
}
