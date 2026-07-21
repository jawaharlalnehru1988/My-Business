package com.company.accounting_service.domain.receipt.controller;

import com.company.accounting_service.domain.receipt.dto.ReceiptDTO;
import com.company.accounting_service.domain.receipt.service.ReceiptService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/receipts")
@RequiredArgsConstructor
public class ReceiptController {

    private final ReceiptService receiptService;

    @GetMapping
    public ResponseEntity<List<ReceiptDTO>> getAllReceipts() {
        return ResponseEntity.ok(receiptService.getAllReceipts());
    }

    @PostMapping
    public ResponseEntity<ReceiptDTO> saveReceipt(@RequestBody ReceiptDTO receiptDTO) {
        return ResponseEntity.ok(receiptService.saveReceipt(receiptDTO));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReceipt(@PathVariable Long id) {
        receiptService.deleteReceipt(id);
        return ResponseEntity.noContent().build();
    }
}
