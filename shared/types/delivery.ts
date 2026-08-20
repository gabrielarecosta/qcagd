export type DeliveryStatus =
  | 'pendiente'
  | 'armado'
  | 'en_camino'
  | 'entregado'
  | 'no_entregado'
  | 'reprogramado';

export type RouteStatus = 'pendiente' | 'en_curso' | 'completada' | 'cancelada';
export type StopStatus = 'pendiente' | 'en_camino' | 'entregado' | 'no_entregado';

export interface DeliveryStop {
  clienteId: string;
  clienteNombre: string;
  direccion: string;
  completado: boolean;
  horaReal?: string;
  motivoNoEntrega?: string;
}

export interface DeliveryRoute {
  id: string;
  branchId: string;
  repartidorId: string; // ID del usuario interno con rol 'repartidor'
  fecha: string;
  estado: DeliveryStatus;
  zona: string;
  horarioEstimado: string;
  pedidosIds: string[];
  stops: DeliveryStop[];
  observaciones?: string;
  plannedBy?: string;
}

export interface DeliveryRouteStop {
  id: string;
  routeId: string;
  orderId: string;
  stopOrder: number;
  status: StopStatus;
  arrivedAt?: string;
  deliveredAt?: string;
  notes?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  formattedAddress?: string;
  originalAddress?: string;
  total?: number;
  paymentMethod?: string;
  abonaCon?: number;
  cambioEstimado?: number;
  latitude?: number;
  longitude?: number;
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

export interface GeoDeliveryRoute {
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
