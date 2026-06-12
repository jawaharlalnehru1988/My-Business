package com.company.accounting.domain.accounting.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class JournalEntryLineRequest {
    @NotNull(message = "Ledger ID is required")
    private Long ledgerId;
    
    private BigDecimal debitAmount = BigDecimal.ZERO;
    private BigDecimal creditAmount = BigDecimal.ZERO;
}
