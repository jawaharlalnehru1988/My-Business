import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportingService, DashboardMetrics } from '../../core/services/reporting.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private reportingService = inject(ReportingService);

  metrics = signal<DashboardMetrics | null>(null);
  loading = signal<boolean>(true);
  error = signal<string>('');

  ngOnInit() {
    this.reportingService.getDashboardMetrics().subscribe({
      next: (data) => {
        this.metrics.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load dashboard metrics. Ensure a Tenant is selected.');
        this.loading.set(false);
      }
    });
  }
}
