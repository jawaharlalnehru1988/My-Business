package com.company.accounting.domain.sales.dto;

import lombok.Data;
import java.util.List;

@Data
public class SaleOrderCreateRequest {
    private Long customerId; // Optional (null = walk-in)
    private Long sourceWarehouseId; // Where the stock will be deducted from
    private List<SaleOrderItemRequest> items;
}
