package com.company.notification.service;

import com.company.notification.dto.NotificationEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    public void sendSaleNotificationEmail(NotificationEvent event) {
        log.info("=======================================================================");
        log.info("MOCK EMAIL SENDER - NEW EMAIL INITIATED");
        log.info("To: {}", event.getRecipientEmail());
        log.info("Subject: New Sale Completed! Invoice: {}", event.getTransactionId());
        log.info("-----------------------------------------------------------------------");
        log.info("Dear Admin,");
        log.info("");
        log.info("A new sale has been successfully completed in the system.");
        log.info("Invoice Number: {}", event.getTransactionId());
        log.info("Total Amount:   ${}", event.getTotalAmount());
        log.info("Time:           {}", event.getTimestamp());
        log.info("");
        log.info("View your Daily Transaction Reports here:");
        log.info("http://localhost/admin/reports");
        log.info("-----------------------------------------------------------------------");
        log.info("=======================================================================");
    }
}
