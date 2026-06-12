import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, BehaviorSubject } from 'rxjs';
import { Tenant } from '../models/tenant.model';

@Injectable({
  providedIn: 'root'
})
export class TenantService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/v1/tenants';

  // BehaviorSubject to broadcast tenant changes to the whole app
  private activeTenantIdSubject = new BehaviorSubject<number | null>(this.getStoredTenantId());
  activeTenantId$ = this.activeTenantIdSubject.asObservable();

  private getStoredTenantId(): number | null {
    const stored = localStorage.getItem('activeTenantId');
    return stored ? parseInt(stored, 10) : null;
  }

  getActiveTenantId(): number | null {
    return this.activeTenantIdSubject.value;
  }

  setActiveTenantId(id: number) {
    localStorage.setItem('activeTenantId', id.toString());
    this.activeTenantIdSubject.next(id);
    // Reload the page to reset state when switching tenants
    window.location.reload();
  }

  getTenants(): Observable<Tenant[]> {
    return this.http.get<Tenant[]>(this.apiUrl);
  }

  createTenant(tenant: Tenant): Observable<Tenant> {
    return this.http.post<Tenant>(this.apiUrl, tenant);
  }

  updateTenant(id: number, tenant: Tenant): Observable<Tenant> {
    return this.http.put<Tenant>(`${this.apiUrl}/${id}`, tenant);
  }
}
