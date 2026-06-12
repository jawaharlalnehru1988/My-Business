import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Customer, SaleOrder, SaleOrderCreateRequest } from '../models/sales.model';

@Injectable({
  providedIn: 'root'
})
export class SalesService {
  private http = inject(HttpClient);
  private apiUrl = 'https://business.asknehru.com/api/v1/sales';

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>(`${this.apiUrl}/customers`);
  }

  createCustomer(customer: Customer): Observable<Customer> {
    return this.http.post<Customer>(`${this.apiUrl}/customers`, customer);
  }

  getSaleOrders(): Observable<SaleOrder[]> {
    return this.http.get<SaleOrder[]>(`${this.apiUrl}/orders`);
  }

  createSaleOrder(request: SaleOrderCreateRequest): Observable<SaleOrder> {
    return this.http.post<SaleOrder>(`${this.apiUrl}/orders`, request);
  }
}
