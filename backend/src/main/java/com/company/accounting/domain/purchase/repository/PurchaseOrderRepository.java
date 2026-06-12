package com.company.accounting.domain.purchase.repository;

import com.company.accounting.domain.purchase.entity.PurchaseOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {
    List<PurchaseOrder> findByTenantId(Long tenantId);
}
