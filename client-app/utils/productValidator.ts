// ============================================================
// VALIDADOR DE PRODUCTOS IMPORTADOS DESDE EXCEL
// ============================================================

import { Product, ProductCategory, ImportRowError, normalizeCategory } from '../types';

/** Columnas obligatorias en el Excel */
export const REQUIRED_COLUMNS = ['codigo', 'nombre', 'categoria', 'presentacion'] as const;

/** Todas las columnas aceptadas */
export const ALL_COLUMNS = [
  'codigo', 'nombre', 'categoria', 'presentacion',
  'precio', 'stock', 'unidad', 'descripcion',
] as const;

/** Normaliza el nombre de una columna (trim + lowercase + quita acentos) */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

/**
 * Verifica que las columnas requeridas estén presentes en el encabezado.
 * Retorna las columnas faltantes.
 */
export function checkRequiredColumns(rawHeaders: string[]): string[] {
  const normalized = rawHeaders.map(normalizeHeader);
  return REQUIRED_COLUMNS.filter(
    (required) => !normalized.includes(required)
  );
}

/**
 * Normaliza los encabezados de una fila cruda.
 * Devuelve un objeto con claves normalizadas.
 */
export function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    result[normalizedKey] = String(value ?? '').trim();
  }
  return result;
}

/**
 * Valida una fila individual del Excel.
 * Retorna los errores encontrados (array vacío = válida).
 */
export function validateRow(
  row: Record<string, string>,
  filaNro: number
): ImportRowError[] {
  const errors: ImportRowError[] = [];

  // codigo obligatorio y no vacío
  if (!row.codigo) {
    errors.push({ fila: filaNro, columna: 'codigo', motivo: 'El código no puede estar vacío' });
  }

  // nombre obligatorio y no vacío
  if (!row.nombre) {
    errors.push({ fila: filaNro, columna: 'nombre', motivo: 'El nombre no puede estar vacío' });
  }

  // categoria obligatoria y válida
  if (!row.categoria) {
    errors.push({ fila: filaNro, columna: 'categoria', motivo: 'La categoría no puede estar vacía' });
  } else if (normalizeCategory(row.categoria) === null) {
    errors.push({
      fila: filaNro,
      columna: 'categoria',
      motivo: `Categoría "${row.categoria}" no reconocida. Valores válidos: Limpieza, Químicos, Perfumería, Descartables, Piscina, Industrial, Hogar, Institucional`,
    });
  }

  // presentacion obligatoria
  if (!row.presentacion) {
    errors.push({ fila: filaNro, columna: 'presentacion', motivo: 'La presentación no puede estar vacía' });
  }

  // precio: si existe, debe ser un número válido
  if (row.precio !== undefined && row.precio !== '') {
    const precioNum = Number(row.precio.replace(',', '.'));
    if (isNaN(precioNum) || precioNum < 0) {
      errors.push({ fila: filaNro, columna: 'precio', motivo: `El precio "${row.precio}" no es un número válido` });
    }
  }

  // stock: si existe, debe ser un entero no negativo
  if (row.stock !== undefined && row.stock !== '') {
    const stockNum = Number(row.stock);
    if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
      errors.push({ fila: filaNro, columna: 'stock', motivo: `El stock "${row.stock}" debe ser un número entero no negativo` });
    }
  }

  return errors;
}

/**
 * Transforma una fila validada en un objeto Product.
 * Asume que la fila ya pasó validateRow sin errores.
 */
export function rowToProduct(row: Record<string, string>, index: number): Product {
  const categoria = normalizeCategory(row.categoria) as ProductCategory;
  const precio = row.precio ? Math.round(Number(row.precio.replace(',', '.')) * 100) / 100 : 0;
  const stock = row.stock ? parseInt(row.stock, 10) : 0;

  return {
    id: `import-${index}`,
    codigo: row.codigo,
    nombre: row.nombre,
    categoria,
    presentacion: row.presentacion,
    precio,
    stock,
    unidad: row.unidad || 'unidad',
    descripcion: row.descripcion || undefined,
    activo: true,
  };
}

/**
 * Detecta códigos duplicados en la lista de productos.
 * Devuelve los códigos que aparecen más de una vez.
 */
export function detectDuplicates(products: Product[]): string[] {
  const seen = new Map<string, number>();
  for (const p of products) {
    seen.set(p.codigo, (seen.get(p.codigo) ?? 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([codigo]) => codigo);
}

/**
 * Elimina duplicados manteniendo solo la primera ocurrencia.
 */
export function deduplicateProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    if (seen.has(p.codigo)) return false;
    seen.add(p.codigo);
    return true;
  });
}
