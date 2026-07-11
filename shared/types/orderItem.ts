import { Product } from './product';

export interface OrderItem {
  producto: Product;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}
