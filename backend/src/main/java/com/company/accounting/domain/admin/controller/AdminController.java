package com.company.accounting.domain.admin.controller;

import com.company.accounting.domain.tenant.entity.Tenant;
import com.company.accounting.domain.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final TenantRepository tenantRepository;

    @GetMapping("/tenants")
    public ResponseEntity<List<Tenant>> getAllTenants() {
        return ResponseEntity.ok(tenantRepository.findAll());
    }
}
