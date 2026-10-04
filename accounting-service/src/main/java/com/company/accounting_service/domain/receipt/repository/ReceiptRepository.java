package com.company.accounting_service.domain.receipt.repository;

import com.company.accounting_service.domain.receipt.entity.Receipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReceiptRepository extends JpaRepository<Receipt, Long> {

    @Query("SELECT r FROM Receipt r WHERE (r.tenantId = :tenantId OR (r.tenantId IS NULL AND :tenantId = 1))")
    List<Receipt> findByTenant(@Param("tenantId") Long tenantId);

    @Query("SELECT r FROM Receipt r WHERE r.id = :id AND (r.tenantId = :tenantId OR (r.tenantId IS NULL AND :tenantId = 1))")
    Optional<Receipt> findByIdAndTenant(@Param("id") Long id, @Param("tenantId") Long tenantId);
}

