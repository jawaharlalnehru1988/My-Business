package com.company.accounting.domain.sales.controller;

import com.company.accounting.domain.sales.dto.SaleOrderCreateRequest;
import com.company.accounting.domain.sales.entity.Customer;
import com.company.accounting.domain.sales.entity.SaleOrder;
import com.company.accounting.domain.sales.service.CustomerService;
import com.company.accounting.domain.sales.service.SaleOrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import com.company.accounting.core.tenant.TenantContext;

@RestController
@RequestMapping("/api/v1/sales")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SalesController {

    private final CustomerService customerService;
    private final SaleOrderService saleOrderService;

    // --- Customers ---
    @GetMapping("/customers")
    public ResponseEntity<List<Customer>> getCustomers() {
        return ResponseEntity.ok(customerService.getAllCustomers());
    }

    @PostMapping("/customers")
    public ResponseEntity<Customer> createCustomer(@RequestBody Customer customer) {
        return ResponseEntity.ok(customerService.createCustomer(customer));
    }

    // --- Sale Orders / Invoices ---
    @GetMapping("/orders")
    public ResponseEntity<List<SaleOrder>> getSaleOrders() {
        return ResponseEntity.ok(saleOrderService.getAllSaleOrders());
    }

    @PostMapping("/orders")
    public ResponseEntity<SaleOrder> createSaleOrder(@RequestBody SaleOrderCreateRequest request) {
        return ResponseEntity.ok(saleOrderService.createSaleOrder(request));
    }
}
