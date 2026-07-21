package com.company.accounting_service.domain.profile.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class BusinessProfileDTO {
    private Long id;
    private String businessName;
    private String address;
    private String state;
    private String gstin;
    private String pan;
    private String email;
    private String phone;
    private String bankName;
    private String accountNumber;
    private String ifsc;
    private String upiId;
    private String logo;
    private Integer logoHeight;
    private String signature;
    private String googleClientId;
    private String googleDriveFolder;
    private List<Map<String, Object>> paymentAccounts;
}
