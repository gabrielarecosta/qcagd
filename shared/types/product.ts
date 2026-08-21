export type ProductCategory =
  | 'limpieza'
  | 'quimicos'
  | 'perfumeria'
  | 'descartables'
  | 'piscina'
  | 'industrial'
  | 'hogar'
  | 'institucional';

export interface Product {
  id: string | number;
  codigo: string;
  nombre: string;
  categoria: ProductCategory;
  subcategoria?: string;
  presentacion?: string;
  unidad: string;
  precio: number;
  precioMayorista?: number;
  descripcion?: string;
  imagen?: string;
  activo: boolean;
  visibleEnApp?: boolean;
  destacado?: boolean;
  fechaActualizacion?: string;
  marca?: string;
}

export interface ProductStock {
  productId: string | number;
  branchId: string | number;
  stock: number;
  stockMinimo: number;
  disponible: boolean;
}

export interface SuperOffer {
  id: string | number;
  nombre: string;
  descripcion?: string;
  precioOferta: number;
  precioOriginal: number;
  activo: boolean;
  createdAt?: string;
}

export interface SuperOfferItem {
  id?: string | number;
  productId: string | number;
  cantidad: number;
  unidad: string;
}
