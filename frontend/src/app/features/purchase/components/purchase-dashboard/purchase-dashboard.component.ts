import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from '../../services/purchase.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { ProductService } from '../../../product/services/product.service';
import { Supplier, PurchaseOrder, PurchaseOrderCreateRequest, PurchaseOrderItemRequest } from '../../models/purchase.model';
import { Warehouse } from '../../../inventory/models/inventory.model';
import { Product } from '../../../product/models/product.model';

@Component({
  selector: 'app-purchase-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase-dashboard.component.html'
})
export class PurchaseDashboardComponent implements OnInit {
  private purchaseService = inject(PurchaseService);
  private inventoryService = inject(InventoryService);
  private productService = inject(ProductService);

  suppliers = signal<Supplier[]>([]);
  purchaseOrders = signal<PurchaseOrder[]>([]);
  warehouses = signal<Warehouse[]>([]);
  products = signal<Product[]>([]);

  // Supplier Form State
  showSupplierForm = signal<boolean>(false);
  newSupplier: Supplier = { name: '', contactPerson: '', phone: '', email: '', gstNumber: '' };

  // PO Form State
  showPOForm = signal<boolean>(false);
  poRequest: PurchaseOrderCreateRequest = { supplierId: 0, targetWarehouseId: 0, items: [] };

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.purchaseService.getSuppliers().subscribe(data => this.suppliers.set(data));
    this.purchaseService.getPurchaseOrders().subscribe(data => this.purchaseOrders.set(data));
    this.inventoryService.getWarehouses().subscribe(data => this.warehouses.set(data));
    this.productService.getProducts().subscribe(data => this.products.set(data));
  }

  toggleSupplierForm() {
    this.showSupplierForm.set(!this.showSupplierForm());
  }

  saveSupplier() {
    if (!this.newSupplier.name) return;
    this.purchaseService.createSupplier(this.newSupplier).subscribe(() => {
      this.loadData();
      this.toggleSupplierForm();
      this.newSupplier = { name: '', contactPerson: '', phone: '', email: '', gstNumber: '' };
    });
  }

  togglePOForm() {
    this.showPOForm.set(!this.showPOForm());
    if (this.showPOForm()) {
      this.poRequest = { supplierId: 0, targetWarehouseId: 0, items: [] };
      this.addPOItem(); // add one empty row
    }
  }

  addPOItem() {
    this.poRequest.items.push({ productId: 0, quantity: 1, unitPrice: 0, taxPercentage: 0 });
  }

  removePOItem(index: number) {
    this.poRequest.items.splice(index, 1);
  }

  calculateSubtotal(): number {
    return this.poRequest.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  calculateTax(): number {
    return this.poRequest.items.reduce((sum, item) => {
      const subTotal = item.quantity * item.unitPrice;
      const tax = subTotal * ((item.taxPercentage || 0) / 100);
      return sum + tax;
    }, 0);
  }

  calculateGrandTotal(): number {
    return this.calculateSubtotal() + this.calculateTax();
  }

  savePO() {
    if (!this.poRequest.supplierId || !this.poRequest.targetWarehouseId || this.poRequest.items.length === 0) {
      alert("Please select a supplier, a warehouse, and at least one item.");
      return;
    }

    this.purchaseService.createPurchaseOrder(this.poRequest).subscribe({
      next: () => {
        alert("Purchase Order completed! Stock has been updated.");
        this.loadData();
        this.togglePOForm();
      },
      error: (err) => {
        console.error(err);
        alert("Failed to create Purchase Order.");
      }
    });
  }
}
