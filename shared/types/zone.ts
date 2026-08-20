// Deprecated type - zones removed
export type Coordinate = [number, number];
export interface DeliveryZone {
  id: string;
  nombre: string;
  name?: string;
  color?: string;
  active?: boolean;
  activo?: boolean;
  polygon?: Coordinate[];
}
