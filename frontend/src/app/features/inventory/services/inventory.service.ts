import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Warehouse, StockTransaction } from '../models/inventory.model';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/v1/inventory';

  getWarehouses(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(`${this.apiUrl}/warehouses`);
  }

  createWarehouse(warehouse: Warehouse): Observable<Warehouse> {
    return this.http.post<Warehouse>(`${this.apiUrl}/warehouses`, warehouse);
  }

  adjustStock(productId: number, warehouseId: number, quantity: number, type: string): Observable<StockTransaction> {
    const params = new HttpParams()
      .set('productId', productId.toString())
      .set('warehouseId', warehouseId.toString())
      .set('quantity', quantity.toString())
      .set('type', type);
      
    return this.http.post<StockTransaction>(`${this.apiUrl}/stock/adjust`, null, { params });
  }

  getStockBalance(productId: number, warehouseId: number): Observable<number> {
    const params = new HttpParams()
      .set('productId', productId.toString())
      .set('warehouseId', warehouseId.toString());
      
    return this.http.get<number>(`${this.apiUrl}/stock/balance`, { params });
  }
}
