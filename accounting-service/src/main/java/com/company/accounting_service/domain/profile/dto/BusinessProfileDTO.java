package com.company.accounting_service.domain.profile.dto;

import com.company.accounting_service.core.json.ExtensibleDTO;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.util.List;
import java.util.Map;

@Data
@EqualsAndHashCode(callSuper = false)
public class BusinessProfileDTO extends ExtensibleDTO {
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
