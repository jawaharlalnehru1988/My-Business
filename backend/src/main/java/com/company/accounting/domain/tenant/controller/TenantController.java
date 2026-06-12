package com.company.accounting.domain.tenant.controller;

import com.company.accounting.domain.tenant.entity.Tenant;
import com.company.accounting.domain.tenant.service.TenantService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/tenants")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // For MVP
public class TenantController {

    private final TenantService tenantService;

    @GetMapping
    public ResponseEntity<List<Tenant>> getAllTenants() {
        return ResponseEntity.ok(tenantService.getAllTenants());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Tenant> getTenantById(@PathVariable Long id) {
        return ResponseEntity.ok(tenantService.getTenantById(id));
    }

    @PostMapping
    public ResponseEntity<Tenant> createTenant(@RequestBody Tenant tenant) {
        return ResponseEntity.ok(tenantService.createTenant(tenant));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Tenant> updateTenant(@PathVariable Long id, @RequestBody Tenant tenant) {
        return ResponseEntity.ok(tenantService.updateTenant(id, tenant));
    }
}
