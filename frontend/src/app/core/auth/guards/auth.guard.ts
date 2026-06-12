import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    // Check if route requires admin
    const requiresAdmin = route.data?.['requiresAdmin'];
    if (requiresAdmin && !authService.isSuperAdmin()) {
      router.navigate(['/']); // Redirect to home if not admin
      return false;
    }

    if (!requiresAdmin && authService.isSuperAdmin() && !authService.selectedAdminTenantId()) {
      router.navigate(['/admin']);
      return false;
    }

    return true;
  }

  router.navigate(['/login']);
  return false;
};
