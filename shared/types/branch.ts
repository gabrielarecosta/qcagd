export interface Branch {
  id: string | number;
  nombre: string;       // GENERAL DEHEZA 1, GENERAL DEHEZA 2, RIO CUARTO, GIGENA
  direccion: string;
  localidad?: string;
  telefono: string;
  whatsapp: string;
  horarioAtencion: string;
  activo: boolean;
  permiteVentaOnline?: boolean;
  permiteVentaPresencial?: boolean;
  permiteReparto?: boolean;
  tipoSucursal?: 'sucursal_completa' | 'deposito' | 'solo_reparto' | 'solo_presencial';
  latitude?: number;
  longitude?: number;
}


