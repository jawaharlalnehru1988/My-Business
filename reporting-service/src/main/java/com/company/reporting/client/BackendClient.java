package com.company.reporting.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.math.BigDecimal;

@FeignClient(name = "backend")
public interface BackendClient {

    @GetMapping("/api/v1/internal/sales/total")
    BigDecimal getTotalSales(@RequestParam("tenantId") Long tenantId);

    @GetMapping("/api/v1/internal/purchases/total")
    BigDecimal getTotalPurchases(@RequestParam("tenantId") Long tenantId);

    @GetMapping("/api/v1/internal/customers/count")
    long getCustomerCount(@RequestParam("tenantId") Long tenantId);

    @GetMapping("/api/v1/internal/suppliers/count")
    long getSupplierCount(@RequestParam("tenantId") Long tenantId);
}
