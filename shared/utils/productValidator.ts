import { Product, ProductCategory, ProductStock } from '../types/product';
import { ImportRowError } from '../types/notification';

export const REQUIRED_COLUMNS = ['codigo', 'nombre', 'categoria', 'presentacion'] as const;

export const ALL_COLUMNS = [
  'codigo', 'nombre', 'categoria', 'subcategoria', 'presentacion',
  'unidad', 'precio', 'precioMayorista', 'stock', 'stockMinimo',
  'sucursal', 'descripcion', 'activo', 'visibleEnApp'
] as const;

// Categorías válidas y mapeo
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
};

export function normalizeCategory(raw: string): ProductCategory | null {
  const normalized = raw
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return CATEGORY_ALIASES[normalized] ?? null;
}

export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

export function checkRequiredColumns(rawHeaders: string[]): string[] {
  const normalized = rawHeaders.map(normalizeHeader);
  return REQUIRED_COLUMNS.filter(
    (required) => !normalized.includes(required)
  );
}

export function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key);
    result[normalizedKey] = String(value ?? '').trim();
  }
  return result;
}

// Interpretar booleanos flexibles (sí/no, 1/0, true/false)
export function parseFlexibleBoolean(val: string, defaultVal: boolean): boolean {
  if (!val) return defaultVal;
  const v = val.toLowerCase().trim();
  if (v === 'si' || v === 'sí' || v === 'true' || v === '1' || v === 's' || v === 'yes' || v === 'y') {
    return true;
  }
  if (v === 'no' || v === 'false' || v === '0' || v === 'n') {
    return false;
  }
  return defaultVal;
}

export function validateRow(
  row: Record<string, string>,
  filaNro: number
): ImportRowError[] {
  const errors: ImportRowError[] = [];

  if (!row.codigo) {
    errors.push({ fila: filaNro, columna: 'codigo', motivo: 'El código es obligatorio.' });
  }

  if (!row.nombre) {
    errors.push({ fila: filaNro, columna: 'nombre', motivo: 'El nombre es obligatorio.' });
  }

  if (!row.categoria) {
    errors.push({ fila: filaNro, columna: 'categoria', motivo: 'La categoría es obligatoria.' });
  } else if (normalizeCategory(row.categoria) === null) {
    errors.push({
      fila: filaNro,
      columna: 'categoria',
      motivo: `Categoría "${row.categoria}" no reconocida.`,
    });
  }

  if (!row.presentacion) {
    errors.push({ fila: filaNro, columna: 'presentacion', motivo: 'La presentación es obligatoria.' });
  }

  // precio
  if (row.precio !== undefined && row.precio !== '') {
    const p = Number(row.precio.replace(',', '.'));
    if (isNaN(p) || p < 0) {
      errors.push({ fila: filaNro, columna: 'precio', motivo: 'El precio debe ser un número positivo.' });
    }
  }

  // precioMayorista
  if (row.precio_mayorista !== undefined && row.precio_mayorista !== '') {
    const pm = Number(row.precio_mayorista.replace(',', '.'));
    if (isNaN(pm) || pm < 0) {
      errors.push({ fila: filaNro, columna: 'precioMayorista', motivo: 'El precio mayorista debe ser un número positivo.' });
    }
  }

  // stock
  if (row.stock !== undefined && row.stock !== '') {
    const s = Number(row.stock);
    if (isNaN(s) || s < 0 || !Number.isInteger(s)) {
      errors.push({ fila: filaNro, columna: 'stock', motivo: 'El stock debe ser un entero no negativo.' });
    }
  }

  // stockMinimo
  if (row.stock_minimo !== undefined && row.stock_minimo !== '') {
    const sm = Number(row.stock_minimo);
    if (isNaN(sm) || sm < 0 || !Number.isInteger(sm)) {
      errors.push({ fila: filaNro, columna: 'stockMinimo', motivo: 'El stock mínimo debe ser un entero no negativo.' });
    }
  }

  // sucursal
  if (row.sucursal) {
    const branchName = row.sucursal.toUpperCase().trim();
    const validNames = ['GENERAL DEHEZA 1', 'GENERAL DEHEZA 2', 'RIO CUARTO', 'GIGENA'];
    if (!validNames.includes(branchName)) {
      errors.push({
        fila: filaNro,
        columna: 'sucursal',
        motivo: `Sucursal "${row.sucursal}" no coincide con las válidas.`,
      });
    }
  }

  return errors;
}

export function rowToProduct(row: Record<string, string>, index: number): Product {
  const categoria = normalizeCategory(row.categoria) as ProductCategory;
  const precio = row.precio ? Math.round(Number(row.precio.replace(',', '.')) * 100) / 100 : 0;
  const precioMayorista = row.precio_mayorista ? Math.round(Number(row.precio_mayorista.replace(',', '.')) * 100) / 100 : undefined;
  
  return {
    id: `import-${index}-${Date.now()}`,
    codigo: row.codigo,
    nombre: row.nombre,
    categoria,
    subcategoria: row.subcategoria || row.nombre.split(' ')[0],
    presentacion: row.presentacion,
    unidad: row.unidad || 'unidad',
    precio,
    precioMayorista,
    descripcion: row.descripcion || undefined,
    activo: parseFlexibleBoolean(row.activo, true),
    visibleEnApp: parseFlexibleBoolean(row.visible_en_app, true),
    fechaActualizacion: new Date().toISOString(),
  };
}

export function detectDuplicates(products: Product[]): string[] {
  const seen = new Map<string, number>();
  for (const p of products) {
    seen.set(p.codigo, (seen.get(p.codigo) ?? 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([codigo]) => codigo);
}

export function deduplicateProducts(products: Product[]): Product[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    if (seen.has(p.codigo)) return false;
    seen.add(p.codigo);
    return true;
  });
}
