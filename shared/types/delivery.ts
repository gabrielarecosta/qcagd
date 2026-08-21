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
  clienteId: string | number;
  clienteNombre: string;
  direccion: string;
  completado: boolean;
  horaReal?: string;
  motivoNoEntrega?: string;
}

export interface DeliveryRoute {
  id: string | number;
  branchId: string | number;
  repartidorId: string; // ID del usuario interno con rol 'repartidor'
  fecha: string;
  estado: DeliveryStatus;
  horarioEstimado: string;
  pedidosIds: (string | number)[];
  stops: DeliveryStop[];
  observaciones?: string;
  plannedBy?: string;
}

export interface DeliveryRouteStop {
  id: string | number;
  routeId: string | number;
  orderId: string | number;
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
