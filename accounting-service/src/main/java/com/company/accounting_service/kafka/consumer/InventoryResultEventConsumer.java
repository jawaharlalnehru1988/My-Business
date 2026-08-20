package com.company.accounting_service.kafka.consumer;

import com.company.accounting_service.domain.accounting.dto.JournalEntryCreateRequest;
import com.company.accounting_service.domain.accounting.dto.JournalEntryLineRequest;
import com.company.accounting_service.domain.accounting.service.AccountingService;
import com.company.accounting_service.kafka.event.InventoryResultEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryResultEventConsumer {

    private final AccountingService accountingService;

    @KafkaListener(topics = "inventory-results", groupId = "accounting-service-group")
    public void consume(InventoryResultEvent event) {
        log.info("Received InventoryResultEvent: {}", event);

        if ("SUCCESS".equals(event.getStatus()) && event.getTransactionId().startsWith("INVOICE_")) {
            if (event.getTotalCogs() != null && event.getTotalCogs().compareTo(java.math.BigDecimal.ZERO) > 0) {
                // Automatically create Journal Entry for COGS
                JournalEntryCreateRequest request = new JournalEntryCreateRequest();
                request.setEntryDate(LocalDate.now());
                request.setReferenceNumber(event.getTransactionId());
                request.setDescription("Auto-generated COGS entry for " + event.getTransactionId());

                JournalEntryLineRequest cogsDebit = new JournalEntryLineRequest();
                cogsDebit.setLedgerId(getLedgerIdByName("Cost of Goods Sold")); // Normally would look this up
                cogsDebit.setDebitAmount(event.getTotalCogs());
                cogsDebit.setCreditAmount(java.math.BigDecimal.ZERO);

                JournalEntryLineRequest inventoryCredit = new JournalEntryLineRequest();
                inventoryCredit.setLedgerId(getLedgerIdByName("Inventory Asset")); // Normally would look this up
                inventoryCredit.setDebitAmount(java.math.BigDecimal.ZERO);
                inventoryCredit.setCreditAmount(event.getTotalCogs());

                request.setLines(List.of(cogsDebit, inventoryCredit));

                try {
                    accountingService.postJournalEntry(request);
                    log.info("Created COGS journal entry for {}", event.getTransactionId());
                } catch (Exception e) {
                    log.error("Failed to create COGS journal entry: {}", e.getMessage());
                }
            }
        }
    }
    
    // Helper method for demo purposes. In reality, you'd fetch ledger IDs dynamically.
    private Long getLedgerIdByName(String name) {
        return "Cost of Goods Sold".equals(name) ? 501L : 101L;
    }
}
