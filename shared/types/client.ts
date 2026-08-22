export type ClientType = 'mayorista' | 'minorista' | 'sucursal' | 'consumidor_final';

export interface Customer {
  id: string | number;
  nombre: string;
  razonSocial?: string;
  cuit?: string;
  telefono: string;
  whatsapp?: string;
  email?: string;
  direccion: string;
  branchId: string | number; // Sucursal habitual asignada
  tipoCliente: ClientType;
  activo: boolean;
  observaciones?: string;
  fechaAlta: string;
  latitude?: number;
  longitude?: number;
  locationVerified?: boolean;
  ctaCteAutorizada?: boolean;
  limiteCredito?: number;
  mayoristaAutorizado?: boolean;
}

export interface CustomerAddress {
  id?: string | number;
  customerId: string | number;
  direccion: string;
  indicaciones?: string;
  latitude?: number;
  longitude?: number;
  locationVerified?: boolean;
  defaultAddress?: boolean;
  createdAt?: string;
}
