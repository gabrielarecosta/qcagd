export interface DeliveryZone {
  id: string;
  branchId: string;
  nombre: string;
  costoEnvio: number;
  pedidoMinimo: number;
  diasReparto: string[];      // ['lunes', 'miercoles', 'viernes']
  horarioEntrega: string;     // '09:00 - 13:00'
  activo: boolean;
}
