package com.company.accounting_service.domain.profile.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "business_profiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BusinessProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "business_name")
    private String businessName;

    private String address;
    private String state;
    private String gstin;
    private String pan;
    private String email;
    private String phone;
    
    @Column(name = "bank_name")
    private String bankName;
    
    @Column(name = "account_number")
    private String accountNumber;
    
    private String ifsc;
    
    @Column(name = "upi_id")
    private String upiId;

    @Column(columnDefinition = "TEXT")
    private String logo;

    @Column(name = "logo_height")
    private Integer logoHeight;

    @Column(columnDefinition = "TEXT")
    private String signature;

    @Column(name = "google_client_id")
    private String googleClientId;

    @Column(name = "google_drive_folder")
    private String googleDriveFolder;

    @Column(name = "payment_accounts_json", columnDefinition = "TEXT")
    private String paymentAccountsJson;
}
