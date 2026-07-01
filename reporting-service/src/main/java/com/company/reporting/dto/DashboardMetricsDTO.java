package com.company.reporting.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class DashboardMetricsDTO {
    private BigDecimal totalSales;
    private BigDecimal totalPurchases;
    private BigDecimal cashBalance;
    private List<LowStockItemDTO> lowStockItems;
    private long totalCustomers;
    private long totalSuppliers;
}
