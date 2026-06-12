package com.company.accounting.domain.purchase.repository;

import com.company.accounting.domain.purchase.entity.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SupplierRepository extends JpaRepository<Supplier, Long> {
    List<Supplier> findByTenantId(Long tenantId);
}
