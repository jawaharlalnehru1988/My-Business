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
  product?: Product;
  productId?: number;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPercentage: number;
  discountAmount: number;
  cgstPercentage: number;
  sgstPercentage: number;
  igstPercentage: number;
  selectedTax: string;
}

@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, UsbScannerDirective],
  templateUrl: './sales-dashboard.component.html',
  styleUrl: './sales-dashboard.component.scss'
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
  showPOSForm = signal<boolean>(true); // default to true to show the vyapar interface
  selectedCustomerId = signal<number | null>(null);
  selectedWarehouseId = signal<number | null>(null);
  customerSearchText = '';
  customerPhoneText = '';
  cart = signal<POSItem[]>([]);
  taxType = signal<'INTRA' | 'INTER'>('INTRA');
  
  totalAmount = computed(() => {
    return this.cart().reduce((sum, item) => sum + (item.quantity * item.unitPrice) - item.discountAmount, 0);
  });

  totalTax = computed(() => {
    return this.cart().reduce((sum, item) => {
      if (!item.product) return sum;
      const subTotal = (item.quantity * item.unitPrice) - item.discountAmount;
      const taxPct = item.cgstPercentage + item.sgstPercentage + item.igstPercentage;
      const tax = subTotal * (taxPct / 100);
      return sum + tax;
    }, 0);
  });

  grandTotal = computed(() => {
    return this.totalAmount() + this.totalTax();
  });

  ngOnInit() {
    this.loadData();
    // Add one empty row initially
    this.addRow();
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
      this.customerSearchText = '';
      this.customerPhoneText = '';
    }
  }

  onCustomerSelect(event: any) {
    const val = event.target.value;
    const customer = this.customers().find(c => (c.name + ' - ' + c.phone) === val || c.name === val || c.phone === val);
    if (customer) {
      this.selectedCustomerId.set(customer.id!);
      this.customerPhoneText = customer.phone || '';
    } else {
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

  addRow() {
    const currentCart = this.cart();
    this.cart.set([...currentCart, {
      quantity: 0,
      unit: 'NONE',
      unitPrice: 0,
      discountPercentage: 0,
      discountAmount: 0,
      cgstPercentage: 0,
      sgstPercentage: 0,
      igstPercentage: 0,
      selectedTax: 'NONE'
    }]);
  }

  onTaxChange(index: number, taxValue: string) {
    const currentCart = this.cart();
    let cgst = 0, sgst = 0, igst = 0;
    if (taxValue.startsWith('GST')) {
      const val = parseFloat(taxValue.split('-')[1]);
      cgst = val / 2;
      sgst = val / 2;
    } else if (taxValue.startsWith('IGST')) {
      const val = parseFloat(taxValue.split('-')[1]);
      igst = val;
    }
    
    currentCart[index].selectedTax = taxValue;
    currentCart[index].cgstPercentage = cgst;
    currentCart[index].sgstPercentage = sgst;
    currentCart[index].igstPercentage = igst;
    this.cart.set([...currentCart]);
  }

  getTaxAmount(index: number): number {
    const item = this.cart()[index];
    const subTotal = (item.quantity * item.unitPrice) - item.discountAmount;
    const taxPct = item.cgstPercentage + item.sgstPercentage + item.igstPercentage;
    return subTotal * (taxPct / 100);
  }

  onRowProductSelected(index: number, productId: any) {
    const currentCart = this.cart();
    const product = this.products().find(p => p.id === Number(productId));
    if (product) {
      let isInter = this.taxType() === 'INTER';
      let selectedTax = 'NONE';
      if (product.cgstPercentage || product.igstPercentage) {
         if (isInter) {
           selectedTax = `IGST-${product.igstPercentage || 0}`;
         } else {
           selectedTax = `GST-${(product.cgstPercentage || 0) + (product.sgstPercentage || 0)}`;
         }
      }

      currentCart[index] = {
        ...currentCart[index],
        product: product,
        productId: product.id,
        quantity: 1,
        unit: 'NONE',
        unitPrice: product.basePrice,
        cgstPercentage: isInter ? 0 : (product.cgstPercentage || 0),
        sgstPercentage: isInter ? 0 : (product.sgstPercentage || 0),
        igstPercentage: isInter ? (product.igstPercentage || 0) : 0,
        selectedTax: selectedTax
      };
      this.cart.set([...currentCart]);
      // Auto-add next row if this was the last row
      if (index === currentCart.length - 1) {
        this.addRow();
      }
    }
  }

  addToCart(product: Product) {
    const currentCart = this.cart();
    const existing = currentCart.find(i => i.product?.id === product.id);
    
    if (existing) {
      existing.quantity += 1;
      this.cart.set([...currentCart]);
    } else {
      const cgst = product.cgstPercentage || 0;
      const sgst = product.sgstPercentage || 0;
      const igst = product.igstPercentage || 0;
      // If there's an empty row, replace it instead of pushing
      const emptyRowIndex = currentCart.findIndex(i => !i.product);
      
      let isInter = this.taxType() === 'INTER';
      let selectedTax = 'NONE';
      if (cgst || igst) {
         selectedTax = isInter ? `IGST-${igst}` : `GST-${cgst + sgst}`;
      }
      
      const newItem: POSItem = { product, productId: product.id, quantity: 1, unit: 'NONE', unitPrice: product.basePrice, discountPercentage: 0, discountAmount: 0, cgstPercentage: isInter ? 0 : cgst, sgstPercentage: isInter ? 0 : sgst, igstPercentage: isInter ? igst : 0, selectedTax: selectedTax };

      if (emptyRowIndex !== -1) {
        currentCart[emptyRowIndex] = newItem;
        this.cart.set([...currentCart]);
        if (emptyRowIndex === currentCart.length - 1) this.addRow();
      } else {
        this.cart.set([...currentCart, newItem]);
        this.addRow();
      }
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
    
    const validItems = this.cart().filter(i => i.product && i.quantity > 0);
    
    if (validItems.length === 0) {
      alert("Cart is empty or no valid items selected.");
      return;
    }

    const request: SaleOrderCreateRequest = {
      customerId: this.selectedCustomerId(),
      sourceWarehouseId: this.selectedWarehouseId()!,
      items: validItems.map(item => ({
        productId: item.product!.id!,
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

        const validItems = this.cart().filter(i => i.product && i.quantity > 0);
        validItems.forEach((item, index) => {
          const sub = (item.quantity * item.unitPrice) - item.discountAmount;
          let tax = 0;
          let row = [
            (index + 1).toString(),
            item.product!.name,
            item.product!.hsnSac || '-',
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
