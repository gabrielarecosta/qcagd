import { OrderItem } from './orderItem';
import { PaymentMethod, PaymentStatus } from './payment';

export type OrderStatus =
  | 'recibido'
  | 'en_preparacion'
  | 'listo_para_reparto'
  | 'en_reparto'
  | 'entregado'
  | 'cancelado';

export interface Order {
  id: string;
  numero: string;
  clienteId: string;
  branchId: string; // Sucursal que lo procesa
  fecha: string;
  items: OrderItem[];
  total: number;
  estado: OrderStatus;
  observaciones?: string; // Internas
  observacionesCliente?: string; // Visibles para cliente
  repartidorId?: string;
  estimatedDelivery?: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  abonaCon?: number;      // Monto con el que abona en caso de efectivo
  cambioEstimado?: number; // Vuelto calculado
}
