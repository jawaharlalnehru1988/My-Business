import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Tenant } from '../../../../core/models/tenant.model';
import { AuthService } from '../../../../core/auth/services/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html'
})
export class AdminDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);
  tenants = signal<Tenant[]>([]);
  loading = signal<boolean>(true);

  ngOnInit() {
    this.http.get<Tenant[]>('http://localhost:8080/api/v1/admin/tenants').subscribe({
      next: (data) => {
        this.tenants.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load tenants', err);
        this.loading.set(false);
      }
    });
  }

  viewBusiness(tenantId: number) {
    this.authService.setAdminTenant(tenantId);
    this.router.navigate(['/dashboard']);
  }
}
