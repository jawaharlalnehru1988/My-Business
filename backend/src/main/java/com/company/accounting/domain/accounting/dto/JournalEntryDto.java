package com.company.accounting.domain.accounting.dto;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class JournalEntryDto {
    private Long id;
    private LocalDate entryDate;
    private String description;
    private String referenceNumber;
    private List<JournalEntryLineDto> lines;
}
