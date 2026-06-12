package com.company.accounting.domain.product.repository;

import com.company.accounting.domain.product.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findByIdAndTenantId(Long id, Long tenantId);
    List<Product> findByTenantId(Long tenantId);
    Optional<Product> findBySkuAndTenantId(String sku, Long tenantId);
}
