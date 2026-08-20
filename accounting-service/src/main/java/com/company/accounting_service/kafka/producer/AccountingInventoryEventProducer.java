package com.company.accounting_service.kafka.producer;

import com.company.accounting_service.kafka.event.InventoryEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccountingInventoryEventProducer {

    private final KafkaTemplate<String, InventoryEvent> kafkaTemplate;
    private static final String TOPIC = "inventory-events";

    public void publishEvent(InventoryEvent event) {
        log.info("Publishing event to topic {}: {}", TOPIC, event);
        kafkaTemplate.send(TOPIC, event.getTransactionId(), event);
    }
}
