package com.company.inventory_service.domain.inventory.dto;

import com.company.inventory_service.core.json.ExtensibleDTO;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.math.BigDecimal;

@Data
@EqualsAndHashCode(callSuper = false)
public class ProductDTO extends ExtensibleDTO {
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
