package com.company.accounting_service.domain.purchase.controller;

import com.company.accounting_service.domain.purchase.dto.PurchaseDTO;
import com.company.accounting_service.domain.purchase.service.PurchaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/purchases")
@RequiredArgsConstructor
public class PurchaseController {

    private final PurchaseService purchaseService;

    @GetMapping
    public ResponseEntity<List<PurchaseDTO>> getAllPurchases() {
        return ResponseEntity.ok(purchaseService.getAllPurchases());
    }

    @PostMapping
    public ResponseEntity<PurchaseDTO> savePurchase(@RequestBody PurchaseDTO purchaseDTO) {
        return ResponseEntity.ok(purchaseService.savePurchase(purchaseDTO));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePurchase(@PathVariable Long id) {
        purchaseService.deletePurchase(id);
        return ResponseEntity.noContent().build();
    }
}
