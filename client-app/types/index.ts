// ============================================================
// TIPOS PRINCIPALES DE LA APP — Actualizado con 8 categorías
// Química/Distribuidora — Demo con datos simulados
// ============================================================

// ------------------------------------------------------------
// PRODUCTO
// ------------------------------------------------------------
export interface Product {
  id: string;
  codigo: string;           // Código interno (ej: "LIM-0001")
  nombre: string;
  descripcion?: string;
  presentacion?: string;    // "Bidón 5L", "Frasco 500ml", etc.
  precio: number;           // Precio unitario en ARS
  unidad: string;           // "litro", "kg", "unidad", "docena", etc.
  categoria: ProductCategory;
  subcategoria?: string;
  stock?: number;
  imagen?: string;
  destacado?: boolean;
  activo: boolean;
  marca?: string;
}

export type ProductCategory =
  | 'limpieza'
  | 'quimicos'
  | 'perfumeria'
  | 'descartables'
  | 'piscina'
  | 'industrial'
  | 'hogar'
  | 'institucional';

export const ALL_PRODUCT_CATEGORIES: ProductCategory[] = [
  'limpieza',
  'quimicos',
  'perfumeria',
  'descartables',
  'piscina',
  'industrial',
  'hogar',
  'institucional',
];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  limpieza: 'Limpieza',
  quimicos: 'Químicos',
  perfumeria: 'Perfumería',
  descartables: 'Descartables',
  piscina: 'Piscina',
  industrial: 'Industrial',
  hogar: 'Hogar',
  institucional: 'Institucional',
};

export const CATEGORY_ICONS: Record<ProductCategory, string> = {
  limpieza: 'spray-bottle',
  quimicos: 'flask-outline',
  perfumeria: 'flower',
  descartables: 'cup-outline',
  piscina: 'pool',
  industrial: 'factory',
  hogar: 'home-outline',
  institucional: 'office-building',
};

// Normaliza texto libre a ProductCategory (útil para importación Excel)
const CATEGORY_ALIASES: Record<string, ProductCategory> = {
  limpieza: 'limpieza',
  'quimico': 'quimicos',
  quimicos: 'quimicos',
  'químicos': 'quimicos',
  'químico': 'quimicos',
  perfumeria: 'perfumeria',
  'perfumería': 'perfumeria',
  descartable: 'descartables',
  descartables: 'descartables',
  piscina: 'piscina',
  pileta: 'piscina',
  industrial: 'industrial',
  hogar: 'hogar',
  casa: 'hogar',
  institucional: 'institucional',
  'institucionales': 'institucional',
  higiene: 'hogar',
  desinfectantes: 'quimicos',
  envases: 'descartables',
  papel: 'institucional',
  otros: 'hogar',
};

export function normalizeCategory(raw: string): ProductCategory | null {
  const normalized = raw
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return CATEGORY_ALIASES[normalized] ?? null;
}

// ------------------------------------------------------------
// ÍTEM DEL CARRITO
// ------------------------------------------------------------
export interface CartItem {
  producto: Product;
  cantidad: number;
}

// ------------------------------------------------------------
// PEDIDO
// ------------------------------------------------------------
export type OrderStatus =
  | 'pendiente'
  | 'recibido'
  | 'en_preparacion'
  | 'listo_para_reparto'
  | 'en_camino'
  | 'en_reparto'
  | 'entregado'
  | 'cancelado';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  recibido: 'Recibido',
  en_preparacion: 'En Preparación',
  listo_para_reparto: 'Listo para Reparto',
  en_camino: '🚚 Tu compra está en camino',
  en_reparto: '🚚 Tu compra está en camino',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  pendiente: '#D97706',
  recibido: '#6B7280',
  en_preparacion: '#2563EB',
  listo_para_reparto: '#10B981',
  en_camino: '#7C3AED',
  en_reparto: '#8B5CF6',
  entregado: '#16A34A',
  cancelado: '#DC2626',
};

export interface OrderItem {
  producto: Product;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Order {
  id: string;
  numero: string;
  clienteId: string;
  fecha: string;
  items: OrderItem[];
  total: number;
  estado: OrderStatus;
  observaciones?: string;
  repartidorId?: string;
  estimatedDelivery?: string;
  branchId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  abonaCon?: number;
  cambioEstimado?: number;
  deliveryDate?: string;
  deliveryStartTime?: string;
  deliveryEndTime?: string;
  deliveryTimeSlotId?: string;
  deliveryMethod?: 'reparto' | 'retiro' | 'whatsapp';
  
  // Tracking
  takenById?: string;
  takenAt?: string;
  deliveredAt?: string;

  originalAddress?: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  addressReference?: string;
  locationVerified?: boolean;
  deliveryZone?: string;
  customerName?: string;
  customerPhone?: string;
  outOfStockPreference?: 'llamar' | 'reemplazar' | 'cancelar';
}


// ------------------------------------------------------------
// CLIENTE
// ------------------------------------------------------------
export interface Customer {
  id: string;
  nombre: string;
  razonSocial?: string;
  cuit?: string;
  telefono: string;
  email?: string;
  direccion: string;
  localidad: string;
  provincia: string;
  branchId?: string;
  tipoCliente?: 'minorista' | 'mayorista' | 'sucursal' | 'consumidor_final';
}

export interface CustomerAddress {
  id?: string;
  customerId: string;
  direccion: string;
  indicaciones?: string;
  latitude?: number;
  longitude?: number;
  locationVerified?: boolean;
  defaultAddress?: boolean;
  createdAt?: string;
}

// ------------------------------------------------------------
// REPARTIDOR
// ------------------------------------------------------------
export interface Deliverer {
  id: string;
  nombre: string;
  telefono: string;
  vehiculo: string;
  patente: string;
  activo: boolean;
  avatar?: string;
}

// ------------------------------------------------------------
// ESTADO DEL REPARTO (tracking)
// ------------------------------------------------------------
export interface DeliveryTracking {
  id: string;
  orderId: string;
  repartidor: Deliverer;
  estado: OrderStatus;
  horaEstimada: string;
  horaReal?: string;
  paradas: DeliveryStop[];
}

export interface DeliveryStop {
  clienteId: string;
  clienteNombre: string;
  direccion: string;
  completado: boolean;
  hora?: string;
}

// ------------------------------------------------------------
// IMPORTACIÓN EXCEL
// ------------------------------------------------------------
export interface ImportRowError {
  fila: number;
  columna: string;
  motivo: string;
}

export interface ImportPreview {
  fileName: string;
  totalFilas: number;
  productosValidos: Product[];
  errores: ImportRowError[];
  duplicados: string[]; // códigos duplicados entre sí
}
