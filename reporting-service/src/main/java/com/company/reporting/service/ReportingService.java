package com.company.reporting.service;

import com.company.reporting.client.BackendClient;
import com.company.reporting.dto.DashboardMetricsDTO;
import com.company.reporting.dto.LowStockItemDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportingService {

    private final BackendClient backendClient;

    public DashboardMetricsDTO getDashboardMetrics() {
        // TODO: Get from security context/token in a real scenario
        Long tenantId = 1L; 

        BigDecimal totalSales = backendClient.getTotalSales(tenantId);
        BigDecimal totalPurchases = backendClient.getTotalPurchases(tenantId);
        
        long customers = backendClient.getCustomerCount(tenantId);
        long suppliers = backendClient.getSupplierCount(tenantId);

        // Cash Balance (Mocked for now as in original service)
        BigDecimal cashBalance = BigDecimal.ZERO; 

        // Low Stock (Mocked for now as in original service)
        List<LowStockItemDTO> lowStockItems = new ArrayList<>();

        return DashboardMetricsDTO.builder()
                .totalSales(totalSales != null ? totalSales : BigDecimal.ZERO)
                .totalPurchases(totalPurchases != null ? totalPurchases : BigDecimal.ZERO)
                .cashBalance(cashBalance)
                .totalCustomers(customers)
                .totalSuppliers(suppliers)
                .lowStockItems(lowStockItems)
                .build();
    }
}
