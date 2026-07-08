package com.company.inventory_service.domain.inventory.controller;

import com.company.inventory_service.domain.inventory.entity.StockTransaction;
import com.company.inventory_service.domain.inventory.entity.Warehouse;
import com.company.inventory_service.domain.inventory.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

import com.company.inventory_service.core.tenant.TenantContext;

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
    public ResponseEntity<com.company.inventory_service.domain.inventory.dto.StockTransactionDto> adjustStock(
            @RequestParam Long productId,
            @RequestParam Long warehouseId,
            @RequestParam BigDecimal quantity,
            @RequestParam String type) {
        StockTransaction tx = inventoryService.adjustStock(productId, warehouseId, quantity, type);
        com.company.inventory_service.domain.inventory.dto.StockTransactionDto dto = com.company.inventory_service.domain.inventory.dto.StockTransactionDto.builder()
                .id(tx.getId())
                .product(com.company.inventory_service.domain.inventory.dto.StockTransactionDto.ProductInfo.builder()
                        .id(tx.getProductId())
                        .name("Product " + tx.getProductId())
                        .build())
                .warehouse(com.company.inventory_service.domain.inventory.dto.StockTransactionDto.WarehouseInfo.builder()
                        .id(tx.getWarehouse().getId())
                        .name(tx.getWarehouse().getName())
                        .build())
                .quantity(tx.getQuantity())
                .transactionType(tx.getTransactionType())
                .createdAt(tx.getCreatedAt())
                .build();
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/stock/balance")
    public ResponseEntity<BigDecimal> getStockBalance(
            @RequestParam Long productId,
            @RequestParam Long warehouseId) {
        return ResponseEntity.ok(inventoryService.getStockBalance(productId, warehouseId));
    }
}


