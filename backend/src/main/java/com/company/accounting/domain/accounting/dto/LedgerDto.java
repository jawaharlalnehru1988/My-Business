package com.company.accounting.domain.accounting.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class LedgerDto {
    private Long id;
    private String name;
    private String accountGroup;
    private BigDecimal currentBalance;
}
