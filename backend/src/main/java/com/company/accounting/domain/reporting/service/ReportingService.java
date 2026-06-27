package com.company.accounting.domain.reporting.service;

import com.company.accounting.core.tenant.TenantContext;


import com.company.accounting.domain.product.entity.Product;
import com.company.accounting.domain.product.repository.ProductRepository;
import com.company.accounting.domain.purchase.entity.PurchaseOrder;
import com.company.accounting.domain.purchase.repository.PurchaseOrderRepository;
import com.company.accounting.domain.purchase.repository.SupplierRepository;
import com.company.accounting.domain.reporting.dto.DashboardMetricsDTO;
import com.company.accounting.domain.reporting.dto.LowStockItemDTO;
import com.company.accounting.domain.sales.entity.SaleOrder;
import com.company.accounting.domain.sales.repository.CustomerRepository;
import com.company.accounting.domain.sales.repository.SaleOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportingService {

    private final SaleOrderRepository saleOrderRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final CustomerRepository customerRepository;
    private final SupplierRepository supplierRepository;
    private final ProductRepository productRepository;

    public DashboardMetricsDTO getDashboardMetrics() {
        Long tenantId = TenantContext.getCurrentTenant();

        // Total Sales
        List<SaleOrder> sales = saleOrderRepository.findByTenantId(tenantId);
        BigDecimal totalSales = sales.stream()
                .map(SaleOrder::getTotalAmount) // exclude tax for sales volume
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Total Purchases
        List<PurchaseOrder> purchases = purchaseOrderRepository.findByTenantId(tenantId);
        BigDecimal totalPurchases = purchases.stream()
                .map(PurchaseOrder::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // Cash Balance (Now maintained by Accounting Microservice)
        BigDecimal cashBalance = BigDecimal.ZERO; 

        // Customers & Suppliers
        long customers = customerRepository.findByTenantId(tenantId).size();
        long suppliers = supplierRepository.findByTenantId(tenantId).size();

        // Low Stock (Now maintained by Inventory Microservice)
        // TODO: Call Inventory Service via REST/Feign to get low stock items.
        List<LowStockItemDTO> lowStockItems = new ArrayList<>();

        return DashboardMetricsDTO.builder()
                .totalSales(totalSales)
                .totalPurchases(totalPurchases)
                .cashBalance(cashBalance)
                .totalCustomers(customers)
                .totalSuppliers(suppliers)
                .lowStockItems(lowStockItems)
                .build();
    }
}
