package com.company.accounting_service.domain.expense.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "expenses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "expense_date")
    private LocalDate date;

    private String description;
    
    private String category;
    
    @Column(precision = 15, scale = 2)
    private BigDecimal amount;
    
    @Column(name = "gst_amount", precision = 15, scale = 2)
    private BigDecimal gstAmount;
    
    @Column(name = "gst_percent", precision = 5, scale = 2)
    private BigDecimal gstPercent;
    
    private Boolean interstate;
    
    @Column(name = "vendor_name")
    private String vendorName;
    
    @Column(name = "vendor_gstin")
    private String vendorGstin;
    
    @Column(name = "invoice_no")
    private String invoiceNo;
    
    @Column(name = "payment_mode")
    private String paymentMode;
    
    @Column(columnDefinition = "TEXT")
    private String note;
}
