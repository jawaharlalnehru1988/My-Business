package com.company.accounting.integration.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDate;
import java.util.List;

@Data
public class JournalEntryCreateRequest {
    @NotNull(message = "Entry date is required")
    private LocalDate entryDate;
    
    @NotBlank(message = "Description is required")
    private String description;
    
    private String referenceNumber;
    
    @NotEmpty(message = "Lines are required")
    private List<JournalEntryLineRequest> lines;
}
