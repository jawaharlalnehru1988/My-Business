package com.company.accounting.domain.sales.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "sale_orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SaleOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "invoice_number", nullable = false, unique = true)
    private String invoiceNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = true) // Null implies Walk-in/Cash Customer
    private Customer customer;

    @Column(name = "sale_date", nullable = false)
    private LocalDate saleDate;

    @Column(nullable = false)
    private String status; // e.g. COMPLETED

    @Column(name = "total_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalAmount; // This is sub-total without tax

    @Column(name = "total_tax", nullable = false, precision = 15, scale = 2, columnDefinition = "numeric(15,2) default 0.00")
    private BigDecimal totalTax;

    @Column(name = "grand_total", nullable = false, precision = 15, scale = 2, columnDefinition = "numeric(15,2) default 0.00")
    private BigDecimal grandTotal;

    @OneToMany(mappedBy = "saleOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<SaleOrderItem> items = new ArrayList<>();

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    public void addItem(SaleOrderItem item) {
        items.add(item);
        item.setSaleOrder(this);
    }
}
