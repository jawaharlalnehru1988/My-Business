import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalesService } from '../../services/sales.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { ProductService } from '../../../product/services/product.service';
import { Customer, SaleOrder, SaleOrderCreateRequest } from '../../models/sales.model';
import { Warehouse } from '../../../inventory/models/inventory.model';
import { Product } from '../../../product/models/product.model';
import { UsbScannerDirective } from '../../../../shared/directives/usb-scanner.directive';
import { TenantService } from '../../../../core/services/tenant.service';
import { Tenant } from '../../../../core/models/tenant.model';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface POSItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  cgstPercentage: number;
  sgstPercentage: number;
  igstPercentage: number;
}

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, UsbScannerDirective],
  templateUrl: './sales-dashboard.component.html'
})
export class SalesDashboardComponent implements OnInit {
  private salesService = inject(SalesService);
  private inventoryService = inject(InventoryService);
  private productService = inject(ProductService);
  private tenantService = inject(TenantService);

  activeTenant = signal<Tenant | null>(null);

  customers = signal<Customer[]>([]);
  saleOrders = signal<SaleOrder[]>([]);
  warehouses = signal<Warehouse[]>([]);
  products = signal<Product[]>([]);

  // Customer Form
  showCustomerForm = signal<boolean>(false);
  newCustomer: Customer = { name: '', phone: '', email: '', gstNumber: '' };

  // POS State
  showPOSForm = signal<boolean>(false);
  selectedCustomerId = signal<number | null>(null);
  selectedWarehouseId = signal<number | null>(null);
  cart = signal<POSItem[]>([]);
  taxType = signal<'INTRA' | 'INTER'>('INTRA');
  
  totalAmount = computed(() => {
    return this.cart().reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  });

  totalTax = computed(() => {
    const isInter = this.taxType() === 'INTER';
    return this.cart().reduce((sum, item) => {
      const subTotal = item.quantity * item.unitPrice;
      const taxPct = isInter ? item.igstPercentage : (item.cgstPercentage + item.sgstPercentage);
      const tax = subTotal * (taxPct / 100);
      return sum + tax;
    }, 0);
  });

  grandTotal = computed(() => {
    return this.totalAmount() + this.totalTax();
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.salesService.getCustomers().subscribe(data => this.customers.set(data));
    this.salesService.getSaleOrders().subscribe(data => this.saleOrders.set(data));
    this.inventoryService.getWarehouses().subscribe(data => this.warehouses.set(data));
    this.productService.getProducts().subscribe(data => this.products.set(data));
    
    const activeId = this.tenantService.getActiveTenantId();
    if (activeId) {
      this.tenantService.getTenants().subscribe(tenants => {
        const tenant = tenants.find(t => t.id === activeId);
        if (tenant) this.activeTenant.set(tenant);
      });
    }
  }

  toggleCustomerForm() {
    this.showCustomerForm.set(!this.showCustomerForm());
  }

  saveCustomer() {
    if (!this.newCustomer.name) return;
    this.salesService.createCustomer(this.newCustomer).subscribe(() => {
      this.loadData();
      this.toggleCustomerForm();
      this.newCustomer = { name: '', phone: '', email: '', gstNumber: '' };
    });
  }

  togglePOSForm() {
    this.showPOSForm.set(!this.showPOSForm());
    if (this.showPOSForm()) {
      this.cart.set([]);
      this.selectedCustomerId.set(null);
    }
  }

  // Auto-triggered by barcode scanner
  onBarcodeScanned(barcode: string) {
    if (!this.showPOSForm()) {
       this.togglePOSForm();
    }
    const product = this.products().find(p => p.sku === barcode);
    if (product) {
      this.addToCart(product);
    } else {
      alert(`Barcode ${barcode} not found in product database.`);
    }
  }

  // Manual selection
  onProductSelected(event: any) {
    const productId = Number(event.target.value);
    if (productId) {
      const product = this.products().find(p => p.id === productId);
      if (product) {
        this.addToCart(product);
      }
      // Reset dropdown
      event.target.value = '';
    }
  }

  addToCart(product: Product) {
    const currentCart = this.cart();
    const existing = currentCart.find(i => i.product.id === product.id);
    
    if (existing) {
      existing.quantity += 1;
      this.cart.set([...currentCart]);
    } else {
      const cgst = product.cgstPercentage || 0;
      const sgst = product.sgstPercentage || 0;
      const igst = product.igstPercentage || 0;
      this.cart.set([...currentCart, { product, quantity: 1, unitPrice: product.basePrice, cgstPercentage: cgst, sgstPercentage: sgst, igstPercentage: igst }]);
    }
  }

  updateQuantity(index: number, qty: number) {
    const currentCart = this.cart();
    if (qty <= 0) {
      this.removeFromCart(index);
    } else {
      currentCart[index].quantity = qty;
      this.cart.set([...currentCart]);
    }
  }

  removeFromCart(index: number) {
    const currentCart = this.cart();
    currentCart.splice(index, 1);
    this.cart.set([...currentCart]);
  }

  completeSale() {
    if (!this.selectedWarehouseId()) {
      alert("Please select a Source Warehouse to deduct stock from.");
      return;
    }
    if (this.cart().length === 0) {
      alert("Cart is empty.");
      return;
    }

    const request: SaleOrderCreateRequest = {
      customerId: this.selectedCustomerId(),
      sourceWarehouseId: this.selectedWarehouseId()!,
      items: this.cart().map(item => ({
        productId: item.product.id!,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      }))
    };

    this.salesService.createSaleOrder(request).subscribe({
      next: (order) => {
        const tenant = this.activeTenant();
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(20);
        doc.text('TAX INVOICE', 105, 15, { align: 'center' });
        
        doc.setFontSize(12);
        if (tenant) {
          doc.text(`Business Name: ${tenant.businessName || 'N/A'}`, 14, 25);
          if (tenant.gstNumber) doc.text(`GST Number: ${tenant.gstNumber}`, 14, 32);
          if (tenant.address) doc.text(`Address: ${tenant.address}`, 14, 39);
        }

        doc.text(`Invoice No: ${order.invoiceNumber}`, 140, 25);
        doc.text(`Date: ${order.saleDate}`, 140, 32);

        const isInter = this.taxType() === 'INTER';
        const tableColumn = isInter 
          ? ["S.No", "Product", "HSN/SAC", "Qty", "Unit Price", "IGST", "IGST Amt", "Total"]
          : ["S.No", "Product", "HSN/SAC", "Qty", "Unit Price", "CGST", "SGST", "Total"];
        
        const tableRows: any[] = [];
        let totalCgst = 0;
        let totalSgst = 0;
        let totalIgst = 0;

        this.cart().forEach((item, index) => {
          const sub = item.quantity * item.unitPrice;
          let tax = 0;
          let row = [
            (index + 1).toString(),
            item.product.name,
            item.product.hsnSac || '-',
            item.quantity.toString(),
            `Rs. ${item.unitPrice.toFixed(2)}`
          ];

          if (isInter) {
            const igstAmt = sub * (item.igstPercentage / 100);
            tax = igstAmt;
            totalIgst += igstAmt;
            row.push(`${item.igstPercentage}%`, `Rs. ${igstAmt.toFixed(2)}`);
          } else {
            const cgstAmt = sub * (item.cgstPercentage / 100);
            const sgstAmt = sub * (item.sgstPercentage / 100);
            tax = cgstAmt + sgstAmt;
            totalCgst += cgstAmt;
            totalSgst += sgstAmt;
            row.push(`Rs. ${cgstAmt.toFixed(2)} (${item.cgstPercentage}%)`, `Rs. ${sgstAmt.toFixed(2)} (${item.sgstPercentage}%)`);
          }
          
          const total = sub + tax;
          row.push(`Rs. ${total.toFixed(2)}`);
          tableRows.push(row);
        });

        autoTable(doc, {
          startY: 45,
          head: [tableColumn],
          body: tableRows,
          theme: 'grid',
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [41, 128, 185], textColor: 255 }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        const pageWidth = doc.internal.pageSize.width;
        
        doc.text(`Subtotal: Rs. ${order.totalAmount.toFixed(2)}`, pageWidth - 14, finalY, { align: 'right' });
        if (isInter) {
          doc.text(`Total IGST: Rs. ${totalIgst.toFixed(2)}`, pageWidth - 14, finalY + 8, { align: 'right' });
        } else {
          doc.text(`Total CGST: Rs. ${totalCgst.toFixed(2)}`, pageWidth - 14, finalY + 8, { align: 'right' });
          doc.text(`Total SGST: Rs. ${totalSgst.toFixed(2)}`, pageWidth - 14, finalY + 16, { align: 'right' });
        }
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`Grand Total: Rs. ${order.grandTotal.toFixed(2)}`, pageWidth - 14, finalY + (isInter ? 18 : 26), { align: 'right' });
        doc.setFont('helvetica', 'normal');

        // Save PDF
        doc.save(`${order.invoiceNumber}.pdf`);

        this.loadData();
        this.togglePOSForm();
      },
      error: (err) => {
        alert("Failed to complete sale: " + (err.error || err.message));
      }
    });
  }
}
