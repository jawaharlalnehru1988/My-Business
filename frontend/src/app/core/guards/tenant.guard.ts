import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from '../services/tenant.service';

export const tenantGuard: CanActivateFn = (route, state) => {
  const tenantService = inject(TenantService);
  const router = inject(Router);

  if (tenantService.getActiveTenantId()) {
    return true;
  }

  // If no active tenant, redirect to business profiles setup
  return router.createUrlTree(['/settings/business-profiles']);
};
