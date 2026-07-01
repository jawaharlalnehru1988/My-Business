package com.company.notification.controller;

import com.company.notification.dto.PushSubscription;
import com.company.notification.service.PushNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class PushSubscriptionController {

    private final PushNotificationService pushNotificationService;

    @PostMapping("/subscribe")
    public ResponseEntity<Void> subscribe(@RequestBody PushSubscription subscription) {
        log.info("Received new push subscription for endpoint: {}", subscription.getEndpoint());
        pushNotificationService.addSubscription(subscription);
        return ResponseEntity.ok().build();
    }
}
