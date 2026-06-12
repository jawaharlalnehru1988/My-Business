import { Routes } from '@angular/router';

import { authGuard } from './core/auth/guards/auth.guard';
import { LoginComponent } from './core/auth/components/login.component';
import { RegisterComponent } from './core/auth/components/register.component';
import { AdminDashboardComponent } from './features/admin/components/admin-dashboard/admin-dashboard.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'admin', component: AdminDashboardComponent, canActivate: [authGuard], data: { requiresAdmin: true } },
  { path: 'dashboard', canActivate: [authGuard], loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'products', canActivate: [authGuard], loadChildren: () => import('./features/product/product.routes').then(m => m.productRoutes) },
  { path: 'inventory', canActivate: [authGuard], loadChildren: () => import('./features/inventory/inventory.routes').then(m => m.inventoryRoutes) },
  { path: 'purchases', canActivate: [authGuard], loadChildren: () => import('./features/purchase/purchase.routes').then(m => m.purchaseRoutes) },
  { path: 'sales', canActivate: [authGuard], loadChildren: () => import('./features/sales/sales.routes').then(m => m.salesRoutes) },
  { path: 'accounting', canActivate: [authGuard], loadChildren: () => import('./features/accounting/accounting.routes').then(m => m.accountingRoutes) },
  { path: 'settings/business-profiles', canActivate: [authGuard], loadComponent: () => import('./features/settings/business-profile/business-profile.component').then(m => m.BusinessProfileComponent) },
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
];
