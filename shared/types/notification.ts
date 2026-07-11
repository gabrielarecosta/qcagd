export type NotificationType =
  | 'nuevo_pedido'
  | 'pedido_listo'
  | 'pedido_en_camino'
  | 'pedido_entregado'
  | 'pago_recibido'
  | 'pago_pendiente'
  | 'bajo_stock'
  | 'pedido_cancelado'
  | 'reparto_reprogramado'
  | 'excel_error';

export interface InternalNotification {
  id: string;
  branchId?: string; // Si es global no tiene branchId
  titulo: string;
  mensaje: string;
  fecha: string;
  leido: boolean;
  tipo: NotificationType;
  referenciaId?: string; // ID de orden o producto
}

export interface ImportRowError {
  fila: number;
  columna: string;
  motivo: string;
}

