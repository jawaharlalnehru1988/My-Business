package com.company.accounting.domain.purchase.controller;

import com.company.accounting.domain.purchase.dto.PurchaseOrderCreateRequest;
import com.company.accounting.domain.purchase.entity.PurchaseOrder;
import com.company.accounting.domain.purchase.entity.Supplier;
import com.company.accounting.domain.purchase.service.PurchaseOrderService;
import com.company.accounting.domain.purchase.service.SupplierService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import com.company.accounting.core.tenant.TenantContext;

@RestController
@RequestMapping("/api/v1/purchases")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PurchaseController {

    private final SupplierService supplierService;
    private final PurchaseOrderService purchaseOrderService;

    // --- Suppliers ---
    @GetMapping("/suppliers")
    public ResponseEntity<List<Supplier>> getSuppliers() {
        return ResponseEntity.ok(supplierService.getAllSuppliers());
    }

    @PostMapping("/suppliers")
    public ResponseEntity<Supplier> createSupplier(@RequestBody Supplier supplier) {
        return ResponseEntity.ok(supplierService.createSupplier(supplier));
    }

    // --- Purchase Orders ---
    @GetMapping("/orders")
    public ResponseEntity<List<PurchaseOrder>> getPurchaseOrders() {
        return ResponseEntity.ok(purchaseOrderService.getAllPurchaseOrders());
    }

    @PostMapping("/orders")
    public ResponseEntity<PurchaseOrder> createPurchaseOrder(@RequestBody PurchaseOrderCreateRequest request) {
        return ResponseEntity.ok(purchaseOrderService.createPurchaseOrder(request));
    }
}

