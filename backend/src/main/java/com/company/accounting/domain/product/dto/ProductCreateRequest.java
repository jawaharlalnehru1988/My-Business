package com.company.accounting.domain.product.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ProductCreateRequest {
    @NotBlank(message = "Product name is required")
    private String name;

    private String sku;
    private String hsnSac;

    @NotNull(message = "Base price is required")
    @Positive(message = "Base price must be positive")
    private BigDecimal basePrice;

    private BigDecimal cgstPercentage;
    private BigDecimal sgstPercentage;
    private BigDecimal igstPercentage;
    private BigDecimal discountPercentage;
    private LocalDate expiryDate;
}
