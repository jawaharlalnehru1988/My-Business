package com.company.accounting_service.domain.purchase.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "purchases")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Purchase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "purchase_date")
    private LocalDate date;

    @Column(name = "supplier_name")
    private String supplierName;

    @Column(name = "supplier_address", columnDefinition = "TEXT")
    private String supplierAddress;

    @Column(name = "supplier_gstin")
    private String supplierGstin;

    @Column(name = "invoice_number")
    private String invoiceNumber;

    @Column(name = "payment_status")
    private String paymentStatus;

    private Boolean interstate;

    @Column(name = "apply_round_off")
    private Boolean applyRoundOff;

    @Column(columnDefinition = "TEXT")
    private String note;

    @OneToMany(mappedBy = "purchase", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<PurchaseLineItem> items = new ArrayList<>();

    public void addItem(PurchaseLineItem item) {
        items.add(item);
        item.setPurchase(this);
    }
}
