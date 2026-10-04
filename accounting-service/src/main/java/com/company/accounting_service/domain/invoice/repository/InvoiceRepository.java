package com.company.accounting_service.domain.invoice.repository;

import com.company.accounting_service.domain.invoice.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
    
    @Query("SELECT i FROM Invoice i WHERE (i.tenantId = :tenantId OR (i.tenantId IS NULL AND :tenantId = 1)) AND (i.isDeleted = false OR i.isDeleted IS NULL)")
    List<Invoice> findActiveByTenant(@Param("tenantId") Long tenantId);

    @Query("SELECT i FROM Invoice i WHERE (i.tenantId = :tenantId OR (i.tenantId IS NULL AND :tenantId = 1)) AND i.isDeleted = true")
    List<Invoice> findTrashByTenant(@Param("tenantId") Long tenantId);

    @Query("SELECT i FROM Invoice i WHERE i.id = :id AND (i.tenantId = :tenantId OR (i.tenantId IS NULL AND :tenantId = 1))")
    Optional<Invoice> findByIdAndTenant(@Param("id") Long id, @Param("tenantId") Long tenantId);

    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);
}


