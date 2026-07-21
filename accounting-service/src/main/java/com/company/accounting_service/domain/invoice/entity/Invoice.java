package com.company.accounting_service.domain.invoice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "invoices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "invoice_number", nullable = false)
    private String invoiceNumber;

    @Column(name = "invoice_type", length = 50)
    private String type;

    @Column(name = "invoice_date")
    private LocalDate invoiceDate;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "client_name")
    private String clientName;

    @Column(name = "client_id")
    private Long clientId;

    @Column(precision = 15, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "cgst_amount", precision = 15, scale = 2)
    private BigDecimal cgstAmount;

    @Column(name = "sgst_amount", precision = 15, scale = 2)
    private BigDecimal sgstAmount;

    @Column(name = "igst_amount", precision = 15, scale = 2)
    private BigDecimal igstAmount;

    @Column(name = "total_amount", precision = 15, scale = 2)
    private BigDecimal totalAmount;

    private String status; // paid, unpaid, partial

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(columnDefinition = "TEXT")
    private String terms;

    @Column(name = "options_json", columnDefinition = "TEXT")
    private String optionsJson;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<InvoiceLineItem> items = new ArrayList<>();

    public void addItem(InvoiceLineItem item) {
        items.add(item);
        item.setInvoice(this);
    }
}
