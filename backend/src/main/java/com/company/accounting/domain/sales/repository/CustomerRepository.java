package com.company.accounting.domain.sales.repository;

import com.company.accounting.domain.sales.entity.Customer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CustomerRepository extends JpaRepository<Customer, Long> {
    List<Customer> findByTenantId(Long tenantId);
}
