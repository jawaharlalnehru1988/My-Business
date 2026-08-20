package com.company.inventory_service.domain.inventory.controller;

import com.company.inventory_service.domain.inventory.service.InventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/inventory/adjustments")
@RequiredArgsConstructor
public class StockAdjustmentController {

    private final InventoryService inventoryService;

    @PostMapping("/reconcile")
    public ResponseEntity<String> reconcileStock(
            @RequestParam Long productId,
            @RequestParam Long warehouseId,
            @RequestParam BigDecimal observedQuantity) {
            
        inventoryService.reconcileStock(productId, warehouseId, observedQuantity);
        return ResponseEntity.ok("Stock reconciled successfully");
    }
}
