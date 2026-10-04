package com.company.accounting_service.domain.invoice.controller;

import com.company.accounting_service.domain.invoice.dto.InvoiceDTO;
import com.company.accounting_service.domain.invoice.service.InvoiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping
@RequiredArgsConstructor
public class TrashController {

    private final InvoiceService invoiceService;

    @GetMapping({"/api/v1/trash", "/api/trash"})
    public ResponseEntity<List<InvoiceDTO>> getTrash() {
        return ResponseEntity.ok(invoiceService.getTrashedInvoices());
    }

    @PostMapping({"/api/v1/trash/{id}/restore", "/api/trash/{id}/restore"})
    public ResponseEntity<Map<String, Object>> restore(@PathVariable Long id) {
        invoiceService.restoreInvoice(id);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        return ResponseEntity.ok(res);
    }

    @DeleteMapping({"/api/v1/trash/{id}", "/api/trash/{id}"})
    public ResponseEntity<Map<String, Object>> purge(@PathVariable Long id) {
        invoiceService.purgeInvoice(id);
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        return ResponseEntity.ok(res);
    }

    @PostMapping({"/api/v1/trash-pdf", "/api/trash-pdf"})
    public ResponseEntity<Map<String, Object>> trashPdf(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> res = new HashMap<>();
        res.put("trashed", true);
        return ResponseEntity.ok(res);
    }
}
