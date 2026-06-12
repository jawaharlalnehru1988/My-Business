package com.company.accounting.domain.accounting.controller;

import com.company.accounting.domain.accounting.dto.JournalEntryCreateRequest;
import com.company.accounting.domain.accounting.dto.JournalEntryDto;
import com.company.accounting.domain.accounting.dto.LedgerDto;
import com.company.accounting.domain.accounting.service.AccountingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/accounting")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // For development purposes
public class AccountingController {

    private final AccountingService accountingService;

    @GetMapping("/ledgers")
    public ResponseEntity<List<LedgerDto>> getAllLedgers() {
        return ResponseEntity.ok(accountingService.getAllLedgers());
    }

    @GetMapping("/journal-entries")
    public ResponseEntity<List<JournalEntryDto>> getAllJournalEntries() {
        return ResponseEntity.ok(accountingService.getAllJournalEntries());
    }

    @PostMapping("/journal-entries")
    public ResponseEntity<JournalEntryDto> postJournalEntry(@Valid @RequestBody JournalEntryCreateRequest request) {
        JournalEntryDto created = accountingService.postJournalEntry(request);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }
}
