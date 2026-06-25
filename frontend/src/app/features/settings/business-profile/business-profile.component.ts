import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TenantService } from '../../../core/services/tenant.service';
import { Tenant } from '../../../core/models/tenant.model';

@Component({
  selector: 'app-business-profile',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './business-profile.component.html'
})
export class BusinessProfileComponent implements OnInit {
  private tenantService = inject(TenantService);

  tenants = signal<Tenant[]>([]);
  activeTenantId = signal<number | null>(null);

  showForm = signal<boolean>(false);
  editingTenantId = signal<number | null>(null);

  form = signal<Partial<Tenant>>({
    businessName: '',
    gstNumber: '',
    address: '',
    contactInfo: ''
  });

  ngOnInit(): void {
    this.loadTenants();
    this.tenantService.activeTenantId$.subscribe(id => this.activeTenantId.set(id));
  }

  loadTenants() {
    this.tenantService.getTenants().subscribe({
      next: (data) => {
        this.tenants.set(data);
        if (data.length > 0 && !this.activeTenantId()) {
          this.switchTenant(data[0].id);
        }
      }
    });
  }

  switchTenant(id: number) {
    this.tenantService.setActiveTenantId(id);
  }

  toggleForm(tenant?: Tenant) {
    if (tenant) {
      this.editingTenantId.set(tenant.id);
      this.form.set({ ...tenant });
    } else {
      this.editingTenantId.set(null);
      this.form.set({
        businessName: '',
        gstNumber: '',
        address: '',
        contactInfo: ''
      });
    }
    this.showForm.set(!this.showForm());
  }

  saveTenant() {
    if (!this.form().businessName) return;

    const tenantData = this.form() as Tenant;
    const editId = this.editingTenantId();

    if (editId !== null) {
      this.tenantService.updateTenant(editId, tenantData).subscribe(() => {
        this.loadTenants();
        this.showForm.set(false);
      });
    } else {
      this.tenantService.createTenant(tenantData).subscribe((newTenant: Tenant) => {
        this.loadTenants();
        this.showForm.set(false);
        this.switchTenant(newTenant.id);
      });
    }
  }
}
