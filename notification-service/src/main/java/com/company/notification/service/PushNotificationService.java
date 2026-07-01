package com.company.notification.service;

import com.company.notification.dto.PushSubscription;
import lombok.extern.slf4j.Slf4j;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.security.Security;
import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
public class PushNotificationService {

    @Value("${spring.vapid.public-key}")
    private String publicKey;

    @Value("${spring.vapid.private-key}")
    private String privateKey;

    @Value("${spring.vapid.subject}")
    private String subject;

    private PushService pushService;

    // In-memory store for subscriptions
    private final List<PushSubscription> subscriptions = new ArrayList<>();

    @PostConstruct
    private void init() {
        try {
            Security.addProvider(new BouncyCastleProvider());
            pushService = new PushService(publicKey, privateKey, subject);
        } catch (Exception e) {
            log.error("Failed to initialize PushService", e);
        }
    }

    public void addSubscription(PushSubscription subscription) {
        subscriptions.add(subscription);
    }

    public void sendPushNotification(String payload) {
        log.info("Sending push notification to {} subscribers", subscriptions.size());
        
        for (PushSubscription sub : subscriptions) {
            try {
                Notification notification = new Notification(
                        sub.getEndpoint(),
                        sub.getKeys().get("p256dh"),
                        sub.getKeys().get("auth"),
                        payload
                );
                
                pushService.send(notification);
            } catch (Exception e) {
                log.error("Error sending push notification to endpoint: {}", sub.getEndpoint(), e);
            }
        }
    }
}
