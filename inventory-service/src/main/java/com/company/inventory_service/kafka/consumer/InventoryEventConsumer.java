package com.company.inventory_service.kafka.consumer;

import com.company.inventory_service.core.tenant.TenantContext;
import com.company.inventory_service.domain.inventory.service.InventoryService;
import com.company.inventory_service.kafka.event.InventoryEvent;
import com.company.inventory_service.kafka.event.InventoryResultEvent;
import com.company.inventory_service.kafka.producer.InventoryEventProducer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryEventConsumer {

    private final InventoryService inventoryService;
    private final InventoryEventProducer inventoryEventProducer;

    @KafkaListener(topics = "inventory-events", groupId = "inventory-service-group")
    public void consume(InventoryEvent event) {
        log.info("Received InventoryEvent: {}", event);

        // Set tenant context for this asynchronous operation
        TenantContext.setCurrentTenant(event.getTenantId());

        InventoryResultEvent result = InventoryResultEvent.builder()
                .transactionId(event.getTransactionId())
                .tenantId(event.getTenantId())
                .build();

        try {
            if ("DEDUCT_STOCK".equals(event.getEventType())) {
                // Perform deductions for each item
                for (InventoryEvent.StockItem item : event.getItems()) {
                    // We negate the quantity because adjustStock expects negative for OUT
                    inventoryService.adjustStock(
                            item.getProductId(),
                            event.getWarehouseId(),
                            item.getQuantity().negate(),
                            "SALE"
                    );
                }
                result.setStatus("SUCCESS");
                result.setMessage("Stock successfully deducted");
            } else {
                result.setStatus("FAILED");
                result.setMessage("Unknown event type");
            }
        } catch (Exception e) {
            log.error("Failed to deduct stock for transaction {}: {}", event.getTransactionId(), e.getMessage());
            result.setStatus("FAILED");
            result.setMessage(e.getMessage());
        } finally {
            // Clear context to prevent leaks
            TenantContext.clear();
        }

        // Send saga response back to monolith
        inventoryEventProducer.publishEvent(result);
    }
}

