package com.company.accounting.domain.accounting.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class JournalEntryLineDto {
    private Long id;
    private Long ledgerId;
    private String ledgerName;
    private BigDecimal debitAmount;
    private BigDecimal creditAmount;
}
