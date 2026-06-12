package com.company.accounting.domain.tenant.service;

import com.company.accounting.core.exceptions.ResourceNotFoundException;
import com.company.accounting.domain.tenant.entity.Tenant;
import com.company.accounting.domain.tenant.repository.TenantRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TenantService {

    private final TenantRepository tenantRepository;

    @PostConstruct
    public void seedDefaultTenant() {
        if (tenantRepository.count() == 0) {
            Tenant defaultTenant = Tenant.builder()
                    .businessName("Default Business")
                    .gstNumber("")
                    .address("123 Main St")
                    .build();
            tenantRepository.save(defaultTenant);
        }
    }

    public List<Tenant> getAllTenants() {
        return tenantRepository.findAll();
    }

    public Tenant getTenantById(Long id) {
        return tenantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant not found with id: " + id));
    }

    @Transactional
    public Tenant createTenant(Tenant tenant) {
        return tenantRepository.save(tenant);
    }

    @Transactional
    public Tenant updateTenant(Long id, Tenant details) {
        Tenant tenant = getTenantById(id);
        tenant.setBusinessName(details.getBusinessName());
        tenant.setGstNumber(details.getGstNumber());
        tenant.setAddress(details.getAddress());
        tenant.setContactInfo(details.getContactInfo());
        return tenantRepository.save(tenant);
    }
}
