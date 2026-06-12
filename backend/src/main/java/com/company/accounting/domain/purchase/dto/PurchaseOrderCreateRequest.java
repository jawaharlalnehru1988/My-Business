package com.company.accounting.domain.purchase.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class PurchaseOrderCreateRequest {
    private Long supplierId;
    private Long targetWarehouseId; // Where the stock will be received
    private List<PurchaseOrderItemRequest> items;
}
