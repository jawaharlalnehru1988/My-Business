package com.company.accounting_service.domain.supplier.dto;

import lombok.Data;

@Data
public class SupplierDTO {
    private Long id;
    private String name;
    private String address;
    private String city;
    private String pin;
    private String state;
    private String gstin;
    private String email;
    private String phone;
    private String country;
    private String notes;
    private String bankName;
    private String accountNumber;
    private String ifscCode;
}
