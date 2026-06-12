import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product.service';
import { Product } from '../../models/product.model';
import { TenantService } from '../../../../core/services/tenant.service';
import { Tenant } from '../../../../core/models/tenant.model';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css'
})
export class ProductListComponent implements OnInit {
  private productService = inject(ProductService);
  
  // State Management with Signals
  products = signal<Product[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  
  // Add/Edit Product Form State
  showForm = signal<boolean>(false);
  editingProductId = signal<number | null>(null);
  newProduct: Product = { name: '', sku: '', hsnSac: '', basePrice: 0, cgstPercentage: 9, sgstPercentage: 9, igstPercentage: 18, discountPercentage: 0, expiryDate: '' };
  errorMessage = signal<string | null>(null);
  submitting = signal<boolean>(false);

  // Barcode State
  selectedBarcodeImage = signal<string | null>(null);
  selectedBarcodeProduct = signal<Product | null>(null);
  activeTenant = signal<Tenant | null>(null);
  private tenantService = inject(TenantService);

  ngOnInit(): void {
    this.loadProducts();
    const activeId = this.tenantService.getActiveTenantId();
    if (activeId) {
      this.tenantService.getTenants().subscribe(tenants => {
        const tenant = tenants.find(t => t.id === activeId);
        if (tenant) this.activeTenant.set(tenant);
      });
    }
  }

  loadProducts(): void {
    this.productService.getProducts().subscribe({
      next: (data) => {
        this.products.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load products. Is the Spring Boot backend running?');
        this.loading.set(false);
        console.error(err);
      }
    });
  }

  toggleForm(): void {
    if (this.showForm() && !this.editingProductId()) {
      this.showForm.set(false);
    } else {
      this.showForm.set(true);
      this.editingProductId.set(null);
    }
    this.errorMessage.set(null);
    if (!this.showForm()) {
      this.resetForm();
    }
  }

  editProduct(product: Product): void {
    this.editingProductId.set(product.id || null);
    this.newProduct = { ...product }; // clone
    this.showForm.set(true);
    this.errorMessage.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetForm(): void {
    this.editingProductId.set(null);
    this.newProduct = { name: '', sku: '', hsnSac: '', basePrice: 0, cgstPercentage: 9, sgstPercentage: 9, igstPercentage: 18, discountPercentage: 0, expiryDate: '' };
  }

  saveProduct(): void {
    this.errorMessage.set(null);
    if (!this.newProduct.name || !this.newProduct.sku) {
      this.errorMessage.set("Name and SKU are required.");
      return;
    }
    
    this.submitting.set(true);
    if (this.editingProductId()) {
      // Update
      this.productService.updateProduct(this.editingProductId()!, this.newProduct).subscribe({
        next: (updated) => {
          this.products.update(curr => curr.map(p => p.id === updated.id ? updated : p));
          this.submitting.set(false);
          this.showForm.set(false);
          this.resetForm();
        },
        error: (err) => {
          alert('Failed to update product.');
          this.submitting.set(false);
          console.error(err);
        }
      });
    } else {
      // Create
      this.productService.createProduct(this.newProduct).subscribe({
        next: (created) => {
          this.products.update(curr => [...curr, created]);
          this.submitting.set(false);
          this.showForm.set(false);
          this.resetForm();
        },
        error: (err) => {
          alert('Failed to add product.');
          this.submitting.set(false);
          console.error(err);
        }
      });
    }
  }

  viewBarcode(product: Product): void {
    if (!product.sku) {
      alert("Product must have an SKU to generate a barcode.");
      return;
    }
    this.selectedBarcodeProduct.set(product);
    this.productService.getBarcode(product.sku).subscribe({
      next: (res) => this.selectedBarcodeImage.set(res.image),
      error: () => alert("Failed to generate barcode")
    });
  }

  closeBarcode(): void {
    this.selectedBarcodeImage.set(null);
    this.selectedBarcodeProduct.set(null);
  }

  printBarcode(): void {
    const printContent = document.getElementById('barcode-label');
    if (printContent) {
      const WindowPrt = window.open('', '', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');
      if (WindowPrt) {
        WindowPrt.document.write(`
          <html>
            <head>
              <title>Print Barcode</title>
              <style>
                body { font-family: sans-serif; margin: 0; padding: 20px; display: flex; justify-content: center; }
                .label-container { border: 1px dashed #ccc; padding: 16px; border-radius: 8px; text-align: center; width: 250px; }
                h4 { margin: 0 0 8px 0; font-size: 14px; }
                img { width: 100%; height: 30px; margin-bottom: 4px; }
                .sku { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
                .name { font-size: 12px; margin-bottom: 4px; }
                .price { font-size: 12px; font-weight: bold; }
              </style>
            </head>
            <body>
              ${printContent.outerHTML}
              <script>
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 500);
              </script>
            </body>
          </html>
        `);
        WindowPrt.document.close();
      }
    }
  }

  downloadBarcode(): void {
    const label = document.getElementById('barcode-label');
    if (label) {
      html2canvas(label, { scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `barcode-${this.selectedBarcodeProduct()?.sku}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    }
  }

  getDiscountedPrice(product: Product): number {
    if (!product.discountPercentage) return product.basePrice;
    return product.basePrice - (product.basePrice * product.discountPercentage / 100);
  }
}
