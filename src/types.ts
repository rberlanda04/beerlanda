export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  promoPrice?: number;
  imageUrl: string;
  stock: number;
  category: string;
  slug: string;
  active: boolean;
}

export interface Coupon {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
  useLimit?: number;
}

export interface Order {
  id: string;
  date: string;
  clientName: string;
  phone: string;
  email: string;
  address: string;
  items: string; // Formatted list of items
  total: number;
  paymentStatus: string;
  paymentMethod?: "mercadopago";
  mpPreferenceId?: string;
  mpPaymentId?: string;
}

export interface Review {
  id: string;
  name: string;
  rating: number; // 1-5
  comment: string;
  active: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
