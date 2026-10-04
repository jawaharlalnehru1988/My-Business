package com.company.accounting_service.domain.supplier.service;

import com.company.accounting_service.domain.supplier.dto.SupplierDTO;
import com.company.accounting_service.domain.supplier.entity.Supplier;
import com.company.accounting_service.domain.supplier.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

import com.company.accounting_service.core.tenant.TenantContext;

@Service
@RequiredArgsConstructor
public class SupplierService {

    private final SupplierRepository supplierRepository;

    @Transactional(readOnly = true)
    public List<SupplierDTO> getAllSuppliers() {
        return supplierRepository.findByTenant(TenantContext.getCurrentTenant()).stream()
                .map(this::mapToDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public SupplierDTO saveSupplier(SupplierDTO dto) {
        Supplier supplier;
        if (dto.getId() != null) {
            supplier = supplierRepository.findByIdAndTenant(dto.getId(), TenantContext.getCurrentTenant())
                    .orElseGet(() -> {
                        Supplier s = new Supplier();
                        s.setTenantId(TenantContext.getCurrentTenant());
                        return s;
                    });
        } else {
            supplier = new Supplier();
            supplier.setTenantId(TenantContext.getCurrentTenant());
        }

        supplier.setName(dto.getName());
        supplier.setAddress(dto.getAddress());
        supplier.setCity(dto.getCity());
        supplier.setPin(dto.getPin());
        supplier.setState(dto.getState());
        supplier.setGstin(dto.getGstin());
        supplier.setEmail(dto.getEmail());
        supplier.setPhone(dto.getPhone());
        supplier.setCountry(dto.getCountry());
        supplier.setNotes(dto.getNotes());
        supplier.setBankName(dto.getBankName());
        supplier.setAccountNumber(dto.getAccountNumber());
        supplier.setIfscCode(dto.getIfscCode());
        supplier.setExtraJson(com.company.accounting_service.core.json.ExtraJson.write(dto.extraFields()));

        supplier = supplierRepository.save(supplier);
        return mapToDTO(supplier);
    }

    @Transactional
    public void deleteSupplier(Long id) {
        Supplier supplier = supplierRepository.findByIdAndTenant(id, TenantContext.getCurrentTenant())
                .orElseThrow(() -> new RuntimeException("Supplier not found"));
        supplierRepository.delete(supplier);
    }

    private SupplierDTO mapToDTO(Supplier supplier) {
        SupplierDTO dto = new SupplierDTO();
        dto.setId(supplier.getId());
        dto.setName(supplier.getName());
        dto.setAddress(supplier.getAddress());
        dto.setCity(supplier.getCity());
        dto.setPin(supplier.getPin());
        dto.setState(supplier.getState());
        dto.setGstin(supplier.getGstin());
        dto.setEmail(supplier.getEmail());
        dto.setPhone(supplier.getPhone());
        dto.setCountry(supplier.getCountry());
        dto.setNotes(supplier.getNotes());
        dto.setBankName(supplier.getBankName());
        dto.setAccountNumber(supplier.getAccountNumber());
        dto.setIfscCode(supplier.getIfscCode());
        dto.extraFields().putAll(com.company.accounting_service.core.json.ExtraJson.read(supplier.getExtraJson()));
        return dto;
    }
}
