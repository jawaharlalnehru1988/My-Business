package com.company.accounting_service.domain.accounting.service;

import com.company.accounting_service.domain.accounting.dto.JournalEntryCreateRequest;
import com.company.accounting_service.domain.accounting.dto.JournalEntryDto;
import com.company.accounting_service.domain.accounting.dto.JournalEntryLineDto;
import com.company.accounting_service.domain.accounting.dto.JournalEntryLineRequest;
import com.company.accounting_service.domain.accounting.dto.LedgerDto;
import com.company.accounting_service.domain.accounting.entity.JournalEntry;
import com.company.accounting_service.domain.accounting.entity.JournalEntryLine;
import com.company.accounting_service.domain.accounting.entity.Ledger;
import com.company.accounting_service.domain.accounting.repository.JournalEntryRepository;
import com.company.accounting_service.domain.accounting.repository.LedgerRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;
import com.company.accounting_service.core.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class AccountingService {

    private final LedgerRepository ledgerRepository;
    private final JournalEntryRepository journalEntryRepository;

    @PostConstruct
    public void seedDefaultLedgers() {
        seedLedger("Cash", "ASSET");
        seedLedger("Sales", "INCOME");
        seedLedger("Purchases", "EXPENSE");
        seedLedger("Output Tax (GST)", "LIABILITY");
        seedLedger("Input Tax (GST)", "ASSET");
    }

    private void seedLedger(String name, String group) {
        Long currentTenant = TenantContext.getCurrentTenant();
        ledgerRepository.findByNameAndTenantId(name, currentTenant).orElseGet(() -> {
            Ledger ledger = Ledger.builder()
                    .name(name)
                    .accountGroup(group)
                    .currentBalance(BigDecimal.ZERO)
                    .tenantId(currentTenant)
                    .build();
            return ledgerRepository.save(ledger);
        });
    }

    public Ledger getOrCreateLedger(String name, String group) {
        Long currentTenant = TenantContext.getCurrentTenant();
        return ledgerRepository.findByNameAndTenantId(name, currentTenant).orElseGet(() -> {
            Ledger ledger = Ledger.builder()
                    .name(name)
                    .accountGroup(group)
                    .currentBalance(BigDecimal.ZERO)
                    .tenantId(currentTenant)
                    .build();
            return ledgerRepository.save(ledger);
        });
    }

    @Transactional(readOnly = true)
    public List<LedgerDto> getAllLedgers() {
        return ledgerRepository.findByTenantId(TenantContext.getCurrentTenant()).stream()
                .map(l -> LedgerDto.builder()
                        .id(l.getId())
                        .name(l.getName())
                        .accountGroup(l.getAccountGroup())
                        .currentBalance(l.getCurrentBalance())
                        .build())
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<JournalEntryDto> getAllJournalEntries() {
        return journalEntryRepository.findByTenantIdOrderByEntryDateDesc(TenantContext.getCurrentTenant()).stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public JournalEntryDto postJournalEntry(JournalEntryCreateRequest request) {
        BigDecimal totalDebits = BigDecimal.ZERO;
        BigDecimal totalCredits = BigDecimal.ZERO;

        for (JournalEntryLineRequest lineReq : request.getLines()) {
            BigDecimal d = lineReq.getDebitAmount() != null ? lineReq.getDebitAmount() : BigDecimal.ZERO;
            BigDecimal c = lineReq.getCreditAmount() != null ? lineReq.getCreditAmount() : BigDecimal.ZERO;
            totalDebits = totalDebits.add(d);
            totalCredits = totalCredits.add(c);
        }

        if (totalDebits.compareTo(totalCredits) != 0) {
            throw new RuntimeException("Total Debits (" + totalDebits + ") must equal Total Credits (" + totalCredits + ")");
        }

        JournalEntry entry = JournalEntry.builder()
                .entryDate(request.getEntryDate())
                .description(request.getDescription())
                .referenceNumber(request.getReferenceNumber())
                .tenantId(TenantContext.getCurrentTenant())
                .build();

        for (JournalEntryLineRequest lineReq : request.getLines()) {
            Ledger ledger;
            if (lineReq.getLedgerId() != null) {
                ledger = ledgerRepository.findById(lineReq.getLedgerId())
                        .orElseThrow(() -> new RuntimeException("Ledger not found: " + lineReq.getLedgerId()));
            } else if (lineReq.getLedgerName() != null) {
                ledger = getOrCreateLedger(lineReq.getLedgerName(), "ASSET"); // default to ASSET if creating
            } else {
                throw new RuntimeException("Either ledgerId or ledgerName must be provided");
            }

            BigDecimal d = lineReq.getDebitAmount() != null ? lineReq.getDebitAmount() : BigDecimal.ZERO;
            BigDecimal c = lineReq.getCreditAmount() != null ? lineReq.getCreditAmount() : BigDecimal.ZERO;

            if (d.compareTo(BigDecimal.ZERO) == 0 && c.compareTo(BigDecimal.ZERO) == 0) {
                continue; // Skip empty lines
            }

            JournalEntryLine line = JournalEntryLine.builder()
                    .ledger(ledger)
                    .debitAmount(d)
                    .creditAmount(c)
                    .build();
            
            entry.addLine(line);

            // Update ledger balance (simplified: Debit increases Asset/Expense, Credit increases Liability/Equity/Income)
            // For MVP, we'll just track raw values or we can do signed:
            // Let's do traditional: Asset/Expense (+ Debit, - Credit)
            // Liability/Income (+ Credit, - Debit)
            boolean isAssetOrExpense = "ASSET".equals(ledger.getAccountGroup()) || "EXPENSE".equals(ledger.getAccountGroup());
            
            BigDecimal balanceChange = isAssetOrExpense ? d.subtract(c) : c.subtract(d);
            ledger.setCurrentBalance(ledger.getCurrentBalance().add(balanceChange));
            ledgerRepository.save(ledger);
        }

        JournalEntry saved = journalEntryRepository.save(entry);
        return mapToDto(saved);
    }

    private JournalEntryDto mapToDto(JournalEntry entry) {
        return JournalEntryDto.builder()
                .id(entry.getId())
                .entryDate(entry.getEntryDate())
                .description(entry.getDescription())
                .referenceNumber(entry.getReferenceNumber())
                .lines(entry.getLines().stream().map(l -> JournalEntryLineDto.builder()
                        .id(l.getId())
                        .ledgerId(l.getLedger().getId())
                        .ledgerName(l.getLedger().getName())
                        .debitAmount(l.getDebitAmount())
                        .creditAmount(l.getCreditAmount())
                        .build()).collect(Collectors.toList()))
                .build();
    }
}
