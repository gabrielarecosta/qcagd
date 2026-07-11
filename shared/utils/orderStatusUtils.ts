import { OrderStatus } from '../types/order';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  recibido: 'Recibido',
  en_preparacion: 'En Preparación',
  listo_para_reparto: 'Listo para Reparto',
  en_reparto: 'En Reparto',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  recibido: '#F59E0B',        // Naranja/Amarillo
  en_preparacion: '#3B82F6',  // Azul
  listo_para_reparto: '#10B981', // Verde claro
  en_reparto: '#8B5CF6',      // Violeta
  entregado: '#059669',       // Verde oscuro
  cancelado: '#EF4444',       // Rojo
};

export function getOrderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status] || status;
}

export function getOrderStatusColor(status: OrderStatus): string {
  return ORDER_STATUS_COLORS[status] || '#64748b';
}

