package com.company.accounting_service.domain.recurring.controller;

import com.company.accounting_service.domain.recurring.dto.RecurringInvoiceDTO;
import com.company.accounting_service.domain.recurring.service.RecurringInvoiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/recurring")
@RequiredArgsConstructor
public class RecurringInvoiceController {

    private final RecurringInvoiceService recurringService;

    @GetMapping
    public ResponseEntity<List<RecurringInvoiceDTO>> getAllRecurringInvoices() {
        return ResponseEntity.ok(recurringService.getAllRecurringInvoices());
    }

    @PostMapping
    public ResponseEntity<RecurringInvoiceDTO> saveRecurringInvoice(@RequestBody RecurringInvoiceDTO recurringInvoiceDTO) {
        return ResponseEntity.ok(recurringService.saveRecurringInvoice(recurringInvoiceDTO));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRecurringInvoice(@PathVariable Long id) {
        recurringService.deleteRecurringInvoice(id);
        return ResponseEntity.noContent().build();
    }
}
