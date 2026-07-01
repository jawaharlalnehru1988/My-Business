package com.company.notification.dto;

import lombok.Data;
import java.util.Map;

@Data
public class PushSubscription {
    private String endpoint;
    private String expirationTime;
    private Map<String, String> keys;
}
