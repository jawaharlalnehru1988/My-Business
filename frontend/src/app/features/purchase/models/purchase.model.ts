export interface Supplier {
  id?: number;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  tenantId?: number;
}

export interface PurchaseOrderItemRequest {
  productId: number;
  quantity: number;
  unitPrice: number;
  taxPercentage?: number;
}

export interface PurchaseOrderCreateRequest {
  supplierId: number;
  targetWarehouseId: number;
  items: PurchaseOrderItemRequest[];
}

export interface PurchaseOrder {
  id?: number;
  orderNumber: string;
  supplier?: Supplier;
  orderDate: string;
  status: string;
  totalAmount: number;
  totalTax: number;
  grandTotal: number;
  tenantId?: number;
}
