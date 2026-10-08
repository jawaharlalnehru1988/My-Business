package com.company.accounting_service.domain.supplier.repository;

import com.company.accounting_service.domain.supplier.entity.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    @Query("SELECT s FROM Supplier s WHERE s.tenantId = :tenantId")
    List<Supplier> findByTenant(@Param("tenantId") Long tenantId);

    @Query("SELECT s FROM Supplier s WHERE s.id = :id AND s.tenantId = :tenantId")
    Optional<Supplier> findByIdAndTenant(@Param("id") Long id, @Param("tenantId") Long tenantId);
}

