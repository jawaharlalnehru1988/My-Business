package com.company.inventory_service.kafka.producer;

import com.company.inventory_service.kafka.event.InventoryResultEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryEventProducer {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private static final String TOPIC = "inventory-results";

    public void publishEvent(InventoryResultEvent event) {
        log.info("Publishing InventoryResultEvent to Kafka: {}", event);
        kafkaTemplate.send(TOPIC, event);
    }
}

