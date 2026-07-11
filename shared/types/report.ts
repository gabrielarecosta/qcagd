export interface KPIReport {
  ventasDia: number;
  ventasSemana: number;
  pedidosPendientes: number;
  pedidosEnPreparacion: number;
  pedidosEnReparto: number;
  pedidosEntregados: number;
  pagosPendientes: number;
  pedidosEfectivo: number;
  pedidosMercadoPago: number;
  clientesActivos: number;
  bajoStockCount: number;
  repartosProgramados: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface GeneralReports {
  ventasPorDia: ChartDataPoint[];
  ventasPorSemana: ChartDataPoint[];
  pedidosPorEstado: ChartDataPoint[];
  productosMasVendidos: { id: string; nombre: string; cantidad: number; total: number }[];
  clientesMasActivos: { id: string; nombre: string; pedidosCount: number; totalGastado: number }[];
  zonasMasEntregas: ChartDataPoint[];
  pagosMasUsados: ChartDataPoint[];
  ventasPorSucursal: ChartDataPoint[];
}
