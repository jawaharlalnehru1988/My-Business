package com.company.accounting.domain.purchase.service;

import com.company.accounting.domain.purchase.entity.Supplier;
import com.company.accounting.domain.purchase.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

import com.company.accounting.core.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class SupplierService {

    private final SupplierRepository supplierRepository;

    public List<Supplier> getAllSuppliers() {
        return supplierRepository.findByTenantId(TenantContext.getCurrentTenant());
    }

    @Transactional
    public Supplier createSupplier(Supplier supplier) {
        if (supplier.getTenantId() == null) supplier.setTenantId(TenantContext.getCurrentTenant());
        return supplierRepository.save(supplier);
    }
}
