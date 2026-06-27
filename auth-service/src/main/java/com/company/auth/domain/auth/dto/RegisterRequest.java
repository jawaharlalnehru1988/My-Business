package com.company.auth.domain.auth.dto;

import lombok.Data;

@Data
public class RegisterRequest {
    private String email;
    private String password;
    
    // Initial Tenant (Business) Details
    private String businessName;
    private String gstNumber;
    private String contactInfo;
    private String address;
}
