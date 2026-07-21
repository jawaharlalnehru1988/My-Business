package com.company.accounting_service.domain.invoice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "invoice_line_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvoiceLineItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @Column(name = "product_id")
    private Long productId;

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

    @Column(precision = 15, scale = 2)
    private BigDecimal amount;
}
