package com.company.accounting.domain.inventory.controller;

import com.company.accounting.domain.inventory.entity.StockTransaction;
import com.company.accounting.domain.inventory.entity.Warehouse;
import com.company.accounting.domain.inventory.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

import com.company.accounting.core.tenant.TenantContext;

@RestController
@RequestMapping("/api/v1/inventory")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class InventoryController {

    private final InventoryService inventoryService;

    // --- Warehouses ---
    @GetMapping("/warehouses")
    public ResponseEntity<List<Warehouse>> getWarehouses() {
        return ResponseEntity.ok(inventoryService.getAllWarehouses());
    }

    @PostMapping("/warehouses")
    public ResponseEntity<Warehouse> createWarehouse(@RequestBody Warehouse warehouse) {
        warehouse.setTenantId(TenantContext.getCurrentTenant());
        return ResponseEntity.ok(inventoryService.createWarehouse(warehouse));
    }

    @PostMapping("/stock/adjust")
    public ResponseEntity<StockTransaction> adjustStock(
            @RequestParam Long productId,
            @RequestParam Long warehouseId,
            @RequestParam BigDecimal quantity,
            @RequestParam String type) {
        return ResponseEntity.ok(inventoryService.adjustStock(productId, warehouseId, quantity, type));
    }

    @GetMapping("/stock/balance")
    public ResponseEntity<BigDecimal> getStockBalance(
            @RequestParam Long productId,
            @RequestParam Long warehouseId) {
        return ResponseEntity.ok(inventoryService.getStockBalance(productId, warehouseId));
    }
}
