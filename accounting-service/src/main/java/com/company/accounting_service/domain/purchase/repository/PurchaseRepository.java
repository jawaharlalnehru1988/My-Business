package com.company.accounting_service.domain.purchase.repository;

import com.company.accounting_service.domain.purchase.entity.Purchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PurchaseRepository extends JpaRepository<Purchase, Long> {

    @Query("SELECT p FROM Purchase p WHERE (p.tenantId = :tenantId OR (p.tenantId IS NULL AND :tenantId = 1))")
    List<Purchase> findByTenant(@Param("tenantId") Long tenantId);

    @Query("SELECT p FROM Purchase p WHERE p.id = :id AND (p.tenantId = :tenantId OR (p.tenantId IS NULL AND :tenantId = 1))")
    Optional<Purchase> findByIdAndTenant(@Param("id") Long id, @Param("tenantId") Long tenantId);
}

