package com.company.accounting.integration.consumer;

import com.company.accounting.domain.purchase.entity.PurchaseOrder;
import com.company.accounting.domain.purchase.repository.PurchaseOrderRepository;
import com.company.accounting.domain.sales.entity.SaleOrder;
import com.company.accounting.domain.sales.repository.SaleOrderRepository;
import com.company.accounting.integration.event.JournalEntryEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class MonolithEventConsumer {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final SaleOrderRepository saleOrderRepository;

    @KafkaListener(topics = "accounting-events", groupId = "monolith-group")
    @Transactional
    public void consume(JournalEntryEvent event) {
        log.info("Received accounting event: {}", event);

        if ("JOURNAL_ENTRY_FAILED".equals(event.getEventType())) {
            log.error("Saga Compensation: Journal entry failed for transaction {}. Reason: {}", 
                      event.getTransactionId(), event.getErrorMessage());
            
            // The transactionId is the referenceNumber (e.g., PO-123456 or SO-123456)
            String ref = event.getTransactionId();
            
            if (ref != null && ref.startsWith("PO-")) {
                Optional<PurchaseOrder> poOpt = purchaseOrderRepository.findByOrderNumber(ref);
                poOpt.ifPresent(po -> {
                    po.setStatus("FAILED_ACCOUNTING");
                    purchaseOrderRepository.save(po);
                    log.info("Compensated Purchase Order: {}", ref);
                });
            } else if (ref != null && ref.startsWith("SO-")) {
                Optional<SaleOrder> soOpt = saleOrderRepository.findByOrderNumber(ref);
                soOpt.ifPresent(so -> {
                    so.setStatus("FAILED_ACCOUNTING");
                    saleOrderRepository.save(so);
                    log.info("Compensated Sale Order: {}", ref);
                });
            }
        } else if ("JOURNAL_ENTRY_CREATED".equals(event.getEventType())) {
            log.info("Saga Success: Journal entry created successfully for transaction {}", event.getTransactionId());
            // Could optionally update status to "COMPLETED_ACCOUNTING"
        }
    }
}
