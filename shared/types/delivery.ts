export type DeliveryStatus =
  | 'pendiente'
  | 'armado'
  | 'en_camino'
  | 'entregado'
  | 'no_entregado'
  | 'reprogramado';

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
}
