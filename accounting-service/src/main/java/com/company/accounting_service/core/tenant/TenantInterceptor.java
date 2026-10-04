package com.company.accounting_service.core.tenant;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

@Component
public class TenantInterceptor implements HandlerInterceptor {

    private static final String TENANT_HEADER = "X-Tenant-ID";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String tenantIdHeader = request.getHeader(TENANT_HEADER);
        if (tenantIdHeader != null && !tenantIdHeader.trim().isEmpty()) {
            try {
                Long tenantId = Long.parseLong(tenantIdHeader.trim());
                TenantContext.setCurrentTenant(tenantId);
            } catch (NumberFormatException e) {
                // Stable fallback hash for string IDs (e.g., firm-alpha)
                long hash = Math.abs((long) tenantIdHeader.trim().hashCode());
                TenantContext.setCurrentTenant(hash == 0 ? 1L : hash);
            }
        } else {
            TenantContext.setCurrentTenant(1L);
        }
        return true;
    }

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) throws Exception {
        TenantContext.clear();
    }
}
