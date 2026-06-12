export interface AuthResponse {
  token: string;
  role: string;
  tenantId: number;
  businessName: string;
}

export interface AuthRequest {
  email?: string;
  password?: string;
}

export interface RegisterRequest {
  email?: string;
  password?: string;
  businessName?: string;
  gstNumber?: string;
  contactInfo?: string;
  address?: string;
}
