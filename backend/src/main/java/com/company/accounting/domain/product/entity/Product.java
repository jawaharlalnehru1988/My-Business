package com.company.accounting.domain.product.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(unique = true, length = 100)
    private String sku;

    @Column(name = "hsn_sac", length = 50)
    private String hsnSac;

    @Column(name = "base_price", nullable = false, precision = 15, scale = 2)
    private BigDecimal basePrice;

    @Column(name = "cgst_percentage", precision = 5, scale = 2)
    private BigDecimal cgstPercentage;

    @Column(name = "sgst_percentage", precision = 5, scale = 2)
    private BigDecimal sgstPercentage;

    @Column(name = "igst_percentage", precision = 5, scale = 2)
    private BigDecimal igstPercentage;

    @Column(name = "discount_percentage", precision = 5, scale = 2)
    private BigDecimal discountPercentage;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;
}
