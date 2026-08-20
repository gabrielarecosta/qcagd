export type Coordinate = [number, number]; // [longitude, latitude]

export interface DeliveryZone {
  id: string;
  name: string;
  nombre?: string; // compatibilidad
  description?: string;
  descripcion?: string; // compatibilidad
  polygon: Coordinate[]; // Vértices en formato GeoJSON [[lng, lat], ...]
  color: string;
  active: boolean;
  activo?: boolean; // compatibilidad
  defaultDriverId?: string | null;
  default_driver_id?: string | null;
  branchId?: string;
  branch_id?: string;
  costoEnvio?: number;
  pedidoMinimo?: number;
  diasReparto?: string[];
  horarioEntrega?: string;
  createdAt?: string;
  updatedAt?: string;
}
