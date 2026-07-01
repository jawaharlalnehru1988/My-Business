package com.company.notification.consumer;

import com.company.notification.dto.NotificationEvent;
import com.company.notification.service.EmailService;
import com.company.notification.service.PushNotificationService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NotificationEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(NotificationEventConsumer.class);
    private final EmailService emailService;
    private final PushNotificationService pushNotificationService;

    @KafkaListener(topics = "notification-events", groupId = "notification-group")
    public void consumeNotificationEvent(NotificationEvent event) {
        log.info("Received notification event: {}", event.getEventType());
        
        if ("SALE_COMPLETED".equals(event.getEventType())) {
            emailService.sendSaleNotificationEmail(event);
            pushNotificationService.sendPushNotification(
                String.format("Sale Completed! Invoice: %s, Amount: %.2f", 
                    event.getTransactionId(), event.getTotalAmount())
            );
        }
    }
}
