package com.company.accounting.domain.accounting.repository;

import com.company.accounting.domain.accounting.entity.Ledger;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LedgerRepository extends JpaRepository<Ledger, Long> {
    List<Ledger> findByTenantId(Long tenantId);
    Optional<Ledger> findByNameAndTenantId(String name, Long tenantId);
}
