package com.company.accounting_service.domain.receipt.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "receipts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Receipt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "receipt_date")
    private LocalDate date;

    @Column(name = "receipt_no")
    private String receiptNo;

    @Column(name = "client_name")
    private String clientName;

    @Column(name = "client_address", columnDefinition = "TEXT")
    private String clientAddress;

    @Column(precision = 15, scale = 2)
    private BigDecimal amount;

    @Column(name = "payment_mode")
    private String paymentMode;

    @Column(name = "reference_no")
    private String referenceNo;

    @Column(name = "against_invoice")
    private String againstInvoice;

    @Column(columnDefinition = "TEXT")
    private String note;
}
