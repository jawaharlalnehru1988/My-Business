import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { TenantService } from './core/services/tenant.service';
import { Tenant } from './core/models/tenant.model';

import { AuthService } from './core/auth/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'frontend';
  public authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  stopViewingBusiness() {
    this.authService.setAdminTenant(null);
    this.router.navigate(['/admin']);
  }
}
