export type PaymentMethod =
  | 'mercado_pago'
  | 'efectivo'
  | 'transferencia'
  | 'cuenta_corriente';

export type PaymentStatus =
  | 'pendiente'
  | 'aprobado'
  | 'rechazado'
  | 'efectivo_al_entregar'
  | 'transferencia_pendiente'
  | 'transferencia_confirmada'
  | 'cuenta_corriente'
  | 'pagado';

export interface PaymentLog {
  id: string;
  orderId: string;
  branchId: string;
  fecha: string;
  monto: number;
  metodo: PaymentMethod;
  estado: PaymentStatus;
  referenciaMock?: string; // ID de transacción MP o banco
  cambioAEntregar?: number;
}
