package com.company.accounting.domain.sales.repository;

import com.company.accounting.domain.sales.entity.SaleOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SaleOrderRepository extends JpaRepository<SaleOrder, Long> {
    List<SaleOrder> findByTenantId(Long tenantId);
    java.util.Optional<SaleOrder> findByOrderNumber(String orderNumber);
}
