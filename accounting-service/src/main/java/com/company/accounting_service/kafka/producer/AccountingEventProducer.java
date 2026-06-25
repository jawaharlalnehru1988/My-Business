package com.company.accounting_service.kafka.producer;

import com.company.accounting_service.kafka.event.JournalEntryEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccountingEventProducer {

    private final KafkaTemplate<String, JournalEntryEvent> kafkaTemplate;
    private static final String TOPIC = "accounting-events";

    public void publishEvent(JournalEntryEvent event) {
        log.info("Publishing event to topic {}: {}", TOPIC, event);
        kafkaTemplate.send(TOPIC, event.getTransactionId(), event);
    }
}
