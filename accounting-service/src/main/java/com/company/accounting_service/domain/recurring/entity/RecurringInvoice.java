package com.company.accounting_service.domain.recurring.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "recurring_invoices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecurringInvoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "client_name")
    private String clientName;

    @Column(name = "client_state")
    private String clientState;

    @Column(name = "client_gstin")
    private String clientGstin;

    @Column(name = "client_address", columnDefinition = "TEXT")
    private String clientAddress;

    private String frequency;

    @Column(name = "invoice_type")
    private String invoiceType;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "next_date")
    private LocalDate nextDate;

    private Boolean active;

    @OneToMany(mappedBy = "recurringInvoice", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RecurringInvoiceLineItem> items = new ArrayList<>();

    public void addItem(RecurringInvoiceLineItem item) {
        items.add(item);
        item.setRecurringInvoice(this);
    }
}
