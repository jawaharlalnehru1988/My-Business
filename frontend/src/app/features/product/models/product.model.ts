export interface Product {
  id?: number;
  name: string;
  sku: string;
  hsnSac: string;
  basePrice: number;
  cgstPercentage?: number;
  sgstPercentage?: number;
  igstPercentage?: number;
  discountPercentage?: number;
  expiryDate?: string;
}
