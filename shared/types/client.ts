export type ClientType = 'mayorista' | 'minorista';

export interface Customer {
  id: string;
  nombre: string;
  razonSocial?: string;
  cuit?: string;
  telefono: string;
  whatsapp?: string;
  email?: string;
  direccion: string;
  zona: string;
  branchId: string; // Sucursal habitual asignada
  tipoCliente: ClientType;
  activo: boolean;
  observaciones?: string;
  fechaAlta: string;
}

export interface CustomerAddress {
  id?: string;
  customerId: string;
  direccion: string;
  zona: string;
  indicaciones?: string;
  latitude?: number;
  longitude?: number;
  locationVerified?: boolean;
  defaultAddress?: boolean;
  createdAt?: string;
}
