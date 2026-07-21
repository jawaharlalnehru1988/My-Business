package com.company.accounting_service.domain.client.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "clients")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Client {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String address;
    private String city;
    private String pin;
    private String state;
    private String gstin;
    private String email;
    private String phone;
    private String country;

    @Column(name = "is_sez")
    private Boolean isSEZ;

    @Column(name = "preferred_paper_size")
    private String preferredPaperSize;

    @Column(name = "preferred_currency")
    private String preferredCurrency;

    @Column(name = "auto_print")
    private Boolean autoPrint;
}
