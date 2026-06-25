package com.company.inventory_service.domain.inventory.repository;

import com.company.inventory_service.domain.inventory.entity.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WarehouseRepository extends JpaRepository<Warehouse, Long> {
    List<Warehouse> findByTenantId(Long tenantId);
}


