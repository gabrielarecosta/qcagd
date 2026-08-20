export type PaymentMethod =
  | 'mercado_pago'
  | 'efectivo'
  | 'transferencia'
  | 'cuenta_corriente'
  | 'pago_a_acordar';

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

export interface PaymentMethodConfig {
  id: string; // 'efectivo' | 'mercadopago' | 'transferencia' | 'pago_a_acordar' | 'cuenta_corriente'
  nombre: string;
  descripcion?: string;
  activo: boolean;
  disponibleMinorista: boolean; // Clientes particulares / consumidor final
  disponibleMayorista: boolean; // Clientes mayoristas
  disponibleSucursal: boolean;  // Sucursales
  orden: number;
}
