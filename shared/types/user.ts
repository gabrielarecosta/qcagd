export type UserRole =
  | 'admin'
  | 'encargado_sucursal'
  | 'ventas'
  | 'deposito'
  | 'repartidor'
  | 'caja'
  | 'solo_lectura';

export interface InternalUser {
  id: string;
  nombre: string;
  email: string;
  rol: UserRole;
  branchId?: string; // null = admin general
  sectorId?: string;
  activo: boolean;
  telefono?: string;
  password?: string;
  auto?: string;
  patente?: string;
  fotoUrl?: string;
  dni?: string;
}
