export interface Customer {
  id?: number;
  name: string;
  phone?: string;
  email?: string;
  gstNumber?: string;
  tenantId?: number;
}

export interface SaleOrderItemRequest {
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface SaleOrderCreateRequest {
  customerId?: number | null;
  sourceWarehouseId: number;
  items: SaleOrderItemRequest[];
}

export interface SaleOrder {
  id?: number;
  invoiceNumber: string;
  customer?: Customer;
  saleDate: string;
  status: string;
  totalAmount: number;
  totalTax: number;
  grandTotal: number;
  tenantId?: number;
}
