package com.company.accounting.core.tenant;

public class TenantContext {
    private static final ThreadLocal<Long> currentTenant = new ThreadLocal<>();

    public static void setCurrentTenant(Long tenantId) {
        currentTenant.set(tenantId);
    }

    public static Long getCurrentTenant() {
        return currentTenant.get() != null ? currentTenant.get() : 1L; // Fallback to 1L if none specified
    }

    public static void clear() {
        currentTenant.remove();
    }
}
