export type RouteStatus = 'pendiente' | 'en_curso' | 'completada' | 'cancelada';
export type StopStatus = 'pendiente' | 'en_camino' | 'entregado' | 'no_entregado';

export interface DeliveryRouteStop {
  id: string;
  routeId: string;
  orderId: string;
  stopOrder: number;
  status: StopStatus;
  arrivedAt?: string;
  deliveredAt?: string;
  notes?: string;
  order?: {
    id: string;
    numero: string;
    customerName?: string;
    customerPhone?: string;
    formattedAddress?: string;
    originalAddress?: string;
    total: number;
    paymentMethod: string;
    abonaCon?: number;
    cambioEstimado?: number;
    latitude?: number;
    longitude?: number;
  };
}

export interface DeliveryRoute {
  id: string;
  zoneId: string;
  zoneName?: string;
  zoneColor?: string;
  driverId?: string | null;
  driverName?: string;
  date: string; // YYYY-MM-DD
  status: RouteStatus;
  totalDistance: number; // en km
  estimatedDuration: number; // en minutos
  notes?: string;
  stops?: DeliveryRouteStop[];
  createdAt?: string;
  updatedAt?: string;
}
