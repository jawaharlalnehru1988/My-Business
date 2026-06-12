import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TenantService } from '../services/tenant.service';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const tenantService = inject(TenantService);
  const activeTenantId = tenantService.getActiveTenantId();

  if (activeTenantId) {
    const authReq = req.clone({
      headers: req.headers.set('X-Tenant-ID', activeTenantId.toString())
    });
    return next(authReq);
  }

  return next(req);
};
