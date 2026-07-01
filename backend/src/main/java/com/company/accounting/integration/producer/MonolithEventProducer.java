package com.company.accounting.integration.producer;

import com.company.accounting.integration.event.JournalEntryEvent;
import com.company.accounting.integration.event.InventoryEvent;
import com.company.accounting.integration.event.NotificationEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class MonolithEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private static final String TOPIC = "monolith-events";

    public void publishEvent(JournalEntryEvent event) {
        log.info("Publishing event to topic {}: {}", TOPIC, event);
        kafkaTemplate.send(TOPIC, event.getTransactionId(), event);
    }

    public void publishInventoryEvent(InventoryEvent event) {
        log.info("Publishing InventoryEvent to topic inventory-events: {}", event);
        kafkaTemplate.send("inventory-events", event.getTransactionId(), event);
    }

    public void publishNotificationEvent(NotificationEvent event) {
        log.info("Publishing NotificationEvent to topic notification-events: {}", event);
        kafkaTemplate.send("notification-events", event.getTransactionId(), event);
    }
}
