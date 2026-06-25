package com.company.accounting.integration.event;

import com.company.accounting.integration.dto.JournalEntryCreateRequest;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JournalEntryEvent {
    private String transactionId; // Unique ID for the Saga transaction
    private String eventType; // e.g., "CREATE_JOURNAL_ENTRY", "JOURNAL_ENTRY_CREATED", "JOURNAL_ENTRY_FAILED"
    private Long tenantId; // Context propagation
    private JournalEntryCreateRequest request; // The actual data
    private String errorMessage; // For failure events
}
