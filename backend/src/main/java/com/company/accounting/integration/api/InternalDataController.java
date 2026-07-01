package com.company.accounting.integration.api;

import com.company.accounting.domain.purchase.entity.PurchaseOrder;
import com.company.accounting.domain.purchase.repository.PurchaseOrderRepository;
import com.company.accounting.domain.purchase.repository.SupplierRepository;
import com.company.accounting.domain.sales.entity.SaleOrder;
import com.company.accounting.domain.sales.repository.CustomerRepository;
import com.company.accounting.domain.sales.repository.SaleOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/internal")
@RequiredArgsConstructor
public class InternalDataController {

    private final SaleOrderRepository saleOrderRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final CustomerRepository customerRepository;
    private final SupplierRepository supplierRepository;

    @GetMapping("/sales/total")
    public BigDecimal getTotalSales(@RequestParam("tenantId") Long tenantId) {
        List<SaleOrder> sales = saleOrderRepository.findByTenantId(tenantId);
        return sales.stream()
                .map(SaleOrder::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @GetMapping("/purchases/total")
    public BigDecimal getTotalPurchases(@RequestParam("tenantId") Long tenantId) {
        List<PurchaseOrder> purchases = purchaseOrderRepository.findByTenantId(tenantId);
        return purchases.stream()
                .map(PurchaseOrder::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @GetMapping("/customers/count")
    public long getCustomerCount(@RequestParam("tenantId") Long tenantId) {
        return customerRepository.findByTenantId(tenantId).size();
    }

    @GetMapping("/suppliers/count")
    public long getSupplierCount(@RequestParam("tenantId") Long tenantId) {
        return supplierRepository.findByTenantId(tenantId).size();
    }
}
