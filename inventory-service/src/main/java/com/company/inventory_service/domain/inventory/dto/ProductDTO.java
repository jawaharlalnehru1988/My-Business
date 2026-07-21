package com.company.inventory_service.domain.inventory.dto;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class ProductDTO {
    private Long id;
    private String name;
    private String hsn;
    private BigDecimal purchasePrice;
    private BigDecimal sellingPrice;
    private BigDecimal rate;
    private BigDecimal taxPercent;
    private String unit;
    private BigDecimal stock;
    private String description;
}
