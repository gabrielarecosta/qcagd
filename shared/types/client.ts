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
