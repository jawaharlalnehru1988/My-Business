import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { ProductService } from '../../../product/services/product.service';
import { Warehouse } from '../../models/inventory.model';
import { Product } from '../../../product/models/product.model';
import { UsbScannerDirective } from '../../../../shared/directives/usb-scanner.directive';

@Component({
  selector: 'app-inventory-dashboard',
  standalone: true,
  imports: [FormsModule, UsbScannerDirective],
  templateUrl: './inventory-dashboard.component.html'
})
export class InventoryDashboardComponent implements OnInit {
  private inventoryService = inject(InventoryService);
  private productService = inject(ProductService);

  warehouses = signal<Warehouse[]>([]);
  products = signal<Product[]>([]);
  
  // Create Warehouse State
  showWarehouseForm = signal<boolean>(false);
  newWarehouse: Warehouse = { name: '', location: '' };

  // Adjust Stock State
  showAdjustForm = signal<boolean>(false);
  selectedProductId = signal<number | null>(null);
  selectedWarehouseId = signal<number | null>(null);
  adjustQuantity = signal<number>(0);
  adjustType = signal<string>('IN');
  currentBalance = signal<number | null>(null);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.inventoryService.getWarehouses().subscribe(data => this.warehouses.set(data));
    this.productService.getProducts().subscribe(data => this.products.set(data));
  }

  toggleWarehouseForm() {
    this.showWarehouseForm.set(!this.showWarehouseForm());
  }

  saveWarehouse() {
    if (!this.newWarehouse.name) return;
    this.inventoryService.createWarehouse(this.newWarehouse).subscribe(() => {
      this.loadData();
      this.toggleWarehouseForm();
      this.newWarehouse = { name: '', location: '' };
    });
  }

  toggleAdjustForm() {
    this.showAdjustForm.set(!this.showAdjustForm());
  }

  onBarcodeScanned(barcode: string) {
    const product = this.products().find(p => p.sku === barcode);
    if (product) {
      this.selectedProductId.set(product.id!);
      this.onSelectionChange();
      if (!this.showAdjustForm()) {
        this.toggleAdjustForm();
      }
    } else {
      alert(`Barcode ${barcode} not found in product database.`);
    }
  }

  onSelectionChange() {
    if (this.selectedProductId() && this.selectedWarehouseId()) {
      this.inventoryService.getStockBalance(this.selectedProductId()!, this.selectedWarehouseId()!)
        .subscribe(balance => this.currentBalance.set(balance));
    } else {
      this.currentBalance.set(null);
    }
  }

  adjustStock() {
    if (!this.selectedProductId() || !this.selectedWarehouseId() || this.adjustQuantity() <= 0) return;
    
    this.inventoryService.adjustStock(
      this.selectedProductId()!,
      this.selectedWarehouseId()!,
      this.adjustType() === 'OUT' ? -this.adjustQuantity() : this.adjustQuantity(),
      this.adjustType()
    ).subscribe(() => {
      alert('Stock adjusted successfully!');
      this.onSelectionChange();
      this.adjustQuantity.set(0);
    });
  }
}
