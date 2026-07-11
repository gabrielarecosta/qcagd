export interface Sector {
  id: string;
  branchId: string;
  nombre: string;       // Administración, Ventas, Depósito, Reparto, Caja, Atención al cliente, Preparación de pedidos
  descripcion?: string;
  activo: boolean;
}
