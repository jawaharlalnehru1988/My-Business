package com.company.accounting.domain.inventory.repository;

import com.company.accounting.domain.inventory.entity.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WarehouseRepository extends JpaRepository<Warehouse, Long> {
    List<Warehouse> findByTenantId(Long tenantId);
}
