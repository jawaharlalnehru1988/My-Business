package com.company.accounting_service.kafka.consumer;

import com.company.accounting_service.core.tenant.TenantContext;
import com.company.accounting_service.domain.accounting.service.AccountingService;
import com.company.accounting_service.kafka.event.JournalEntryEvent;
import com.company.accounting_service.kafka.producer.AccountingEventProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccountingEventConsumer {

    private final AccountingService accountingService;
    private final AccountingEventProducer producer;

    @KafkaListener(topics = "monolith-events", groupId = "accounting-group")
    public void consume(JournalEntryEvent event) {
        log.info("Received event: {}", event);

        if ("CREATE_JOURNAL_ENTRY".equals(event.getEventType())) {
            try {
                // Set the tenant context for this execution thread
                TenantContext.setCurrentTenant(event.getTenantId());
                
                // Process the journal entry
                accountingService.postJournalEntry(event.getRequest());
                
                // On success, publish success event (if the saga requires it)
                JournalEntryEvent successEvent = JournalEntryEvent.builder()
                        .transactionId(event.getTransactionId())
                        .eventType("JOURNAL_ENTRY_CREATED")
                        .tenantId(event.getTenantId())
                        .build();
                producer.publishEvent(successEvent);

            } catch (Exception e) {
                log.error("Failed to process journal entry for transaction {}", event.getTransactionId(), e);
                // Publish failure event to trigger saga compensation in the monolith
                JournalEntryEvent failureEvent = JournalEntryEvent.builder()
                        .transactionId(event.getTransactionId())
                        .eventType("JOURNAL_ENTRY_FAILED")
                        .tenantId(event.getTenantId())
                        .errorMessage(e.getMessage())
                        .build();
                producer.publishEvent(failureEvent);
            } finally {
                TenantContext.clear();
            }
        }
    }
}
