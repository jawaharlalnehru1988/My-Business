package com.company.accounting_service.domain.client.dto;

import lombok.Data;

@Data
public class ClientDTO {
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
    private Boolean isSEZ;
    private String preferredPaperSize;
    private String preferredCurrency;
    private Boolean autoPrint;
}
