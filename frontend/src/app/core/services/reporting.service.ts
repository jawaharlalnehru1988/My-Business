import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface LowStockItem {
  productName: string;
  sku: string;
  currentStock: number;
  minimumStock: number;
}

export interface DashboardMetrics {
  totalSales: number;
  totalPurchases: number;
  cashBalance: number;
  lowStockItems: LowStockItem[];
  totalCustomers: number;
  totalSuppliers: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReportingService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/v1/reports';

  getDashboardMetrics(): Observable<DashboardMetrics> {
    return this.http.get<DashboardMetrics>(`${this.apiUrl}/dashboard`);
  }
}
