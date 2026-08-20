export interface Branch {
  id: string;
  nombre: string;       // GENERAL DEHEZA 1, GENERAL DEHEZA 2, RIO CUARTO, GIGENA
  direccion: string;
  telefono: string;
  whatsapp: string;
  horarioAtencion: string;
  activo: boolean;
  latitude?: number;
  longitude?: number;
}
