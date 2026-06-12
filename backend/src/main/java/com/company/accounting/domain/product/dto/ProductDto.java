package com.company.accounting.domain.product.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class ProductDto {
    private Long id;
    private String name;
    private String sku;
    private String hsnSac;
    private BigDecimal basePrice;
    private BigDecimal cgstPercentage;
    private BigDecimal sgstPercentage;
    private BigDecimal igstPercentage;
    private BigDecimal discountPercentage;
    private LocalDate expiryDate;
}
