import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    let headers = req.headers.set('Authorization', `Bearer ${token}`);
    
    if (authService.isSuperAdmin() && authService.selectedAdminTenantId()) {
      headers = headers.set('X-TenantID', authService.selectedAdminTenantId()!.toString());
    }

    const clonedReq = req.clone({ headers });
    return next(clonedReq);
  }

  return next(req);
};
