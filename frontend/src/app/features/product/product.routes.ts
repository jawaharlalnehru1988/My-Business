import { Routes } from '@angular/router';

export const productRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/product-list/product-list.component').then(c => c.ProductListComponent)
  }
];
