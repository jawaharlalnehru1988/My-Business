export interface Warehouse {
  id?: number;
  name: string;
  location: string;
  tenantId?: number;
}

export interface StockTransaction {
  id?: number;
  product: { id: number; name: string };
  warehouse: { id: number; name: string };
  quantity: number;
  transactionType: string;
  createdAt?: string;
}
