import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { AuthRequest, AuthResponse, RegisterRequest } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'https://business.asknehru.com/api/v1/auth';
  
  public currentUser = signal<AuthResponse | null>(null);
  public selectedAdminTenantId = signal<number | null>(null);

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage() {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      this.currentUser.set(JSON.parse(userStr));
    }
    const adminTenantStr = localStorage.getItem('selectedAdminTenantId');
    if (adminTenantStr) {
      this.selectedAdminTenantId.set(Number(adminTenantStr));
    }
  }

  login(request: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(res => {
        localStorage.setItem('currentUser', JSON.stringify(res));
        localStorage.setItem('token', res.token);
        this.currentUser.set(res);
      })
    );
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request).pipe(
      tap(res => {
        localStorage.setItem('currentUser', JSON.stringify(res));
        localStorage.setItem('token', res.token);
        this.currentUser.set(res);
      })
    );
  }

  logout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    localStorage.removeItem('selectedAdminTenantId');
    this.currentUser.set(null);
    this.selectedAdminTenantId.set(null);
  }

  setAdminTenant(tenantId: number | null) {
    if (tenantId) {
      localStorage.setItem('selectedAdminTenantId', tenantId.toString());
    } else {
      localStorage.removeItem('selectedAdminTenantId');
    }
    this.selectedAdminTenantId.set(tenantId);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  isSuperAdmin(): boolean {
    return this.currentUser()?.role === 'ROLE_SUPER_ADMIN';
  }
}
