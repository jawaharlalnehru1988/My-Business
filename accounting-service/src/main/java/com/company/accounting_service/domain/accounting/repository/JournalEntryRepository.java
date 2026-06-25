package com.company.accounting_service.domain.accounting.repository;

import com.company.accounting_service.domain.accounting.entity.JournalEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JournalEntryRepository extends JpaRepository<JournalEntry, Long> {
    List<JournalEntry> findByTenantIdOrderByEntryDateDesc(Long tenantId);
}
