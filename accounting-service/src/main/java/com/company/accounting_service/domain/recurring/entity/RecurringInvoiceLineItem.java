package com.company.accounting_service.domain.recurring.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "recurring_invoice_line_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RecurringInvoiceLineItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recurring_invoice_id", nullable = false)
    private RecurringInvoice recurringInvoice;

    private String name;
    
    private String hsn;
    
    @Column(precision = 15, scale = 3)
    private BigDecimal quantity;
    
    @Column(precision = 15, scale = 2)
    private BigDecimal rate;
    
    @Column(name = "tax_percent", precision = 5, scale = 2)
    private BigDecimal taxPercent;
    
    @Column(precision = 15, scale = 2)
    private BigDecimal discount;
}
