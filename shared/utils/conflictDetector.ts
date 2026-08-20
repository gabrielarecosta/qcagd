import { Product } from '../types/product';

export interface StagedRow {
  filaNumero: number;
  codigo: string;
  descripcion: string;
  marca: string;
  precio: number;
  stock: number;
  estado: 'pending' | 'requires_review' | 'ready' | 'completed' | 'ignored' | 'error';
  action?: 'create_new' | 'update_by_code' | 'replace_code' | 'ignored';
  conflictReason?: 
    | 'multiple_descriptions_exist' 
    | 'duplicate_description_in_excel' 
    | 'new_code_belongs_to_other' 
    | 'description_matches_different_brand' 
    | 'ambiguous_match' 
    | 'split_match' 
    | 'invalid_data';
  validationErrors?: string[];
  matchedProductId?: string;
  matchedProductName?: string;
  matchedProductCode?: string;
  matchedProductPrice?: number;
  matchedProductStock?: number;
  matchedProductBrand?: string;
}

export function normalizeCode(c: any): string {
  if (c === undefined || c === null) return '';
  let str = String(c).trim();
  // Quitar sufijo decimal .0 inyectado por parseadores de Excel en campos numéricos
  if (str.endsWith('.0')) {
    str = str.substring(0, str.length - 2);
  }
  return str
    .replace(/\s+/g, '') // remove spaces
    .replace(/[^a-zA-Z0-9]/g, ''); // alphanumeric only (keep case or ignore case consistently)
}

export function normalizeText(t: any): string {
  if (t === undefined || t === null) return '';
  return String(t)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\s+/g, ' '); // collapse duplicate spaces to single space
}

/**
 * Analiza filas de Excel crudas y genera filas de staging (StagedRow) detectando
 * coincidencias, cambios de códigos y conflictos.
 */
export function analyzeImportRows(
  rawRows: any[][], // filas del Excel leídas como arrays indexados
  existingProducts: (Product & { stock?: number })[]
): StagedRow[] {
  const stagedRows: StagedRow[] = [];

  // 1. Agrupar filas del Excel por descripción normalizada para detectar duplicados en el propio archivo
  const excelDescCounts: Record<string, number> = {};
  rawRows.forEach((row) => {
    if (row.length < 3) return;
    const desc = row[2];
    if (desc) {
      const normDesc = normalizeText(desc);
      excelDescCounts[normDesc] = (excelDescCounts[normDesc] || 0) + 1;
    }
  });

  // Encontrar el último índice de fila para cada código en el Excel
  const lastIndexByCode = new Map<string, number>();
  rawRows.forEach((row, index) => {
    if (row && row.length > 0) {
      const code = normalizeCode(row[0]);
      if (code) {
        lastIndexByCode.set(code, index);
      }
    }
  });

  // 2. Procesar cada fila
  rawRows.forEach((row, index) => {
    const filaNumero = index + 2; // Fila 1 es el encabezado
    if (!row || row.length === 0) return;

    const rawCode = row[0];
    const rawDesc = row[2];
    const rawBrand = row[3];
    const rawPrice = row[5];
    const rawStock = row[6];

    // Ignorar filas totalmente vacías (ej. al final de la planilla)
    if ((rawCode === undefined || rawCode === null || String(rawCode).trim() === '') &&
        (rawDesc === undefined || rawDesc === null || String(rawDesc).trim() === '') &&
        (rawPrice === undefined || rawPrice === null || String(rawPrice).trim() === '') &&
        (rawStock === undefined || rawStock === null || String(rawStock).trim() === '')) {
      return;
    }

    const code = normalizeCode(rawCode);
    const desc = rawDesc ? String(rawDesc).trim() : '';
    const brand = rawBrand ? String(rawBrand).trim() : '';

    // Si este código se repite más adelante en el archivo, ignoramos esta fila para evitar duplicidades
    const lastIndex = lastIndexByCode.get(code);
    if (code && lastIndex !== undefined && lastIndex !== index) {
      stagedRows.push({
        filaNumero,
        codigo: code,
        descripcion: desc,
        marca: brand,
        precio: Number(rawPrice) || 0,
        stock: Number(rawStock) || 0,
        estado: 'ignored',
        action: 'ignored',
        validationErrors: ['Fila omitida: Existe un registro posterior en el archivo Excel con el mismo código comercial.']
      });
      return;
    }

    const validationErrors: string[] = [];

    // Validaciones básicas de campos obligatorios
    if (!code) {
      validationErrors.push('El código es obligatorio y no puede estar vacío.');
    }
    if (!desc) {
      validationErrors.push('La descripción (nombre) es obligatoria y no puede estar vacía.');
    }

    // Validación de precio
    let precio = 0;
    if (rawPrice === undefined || rawPrice === null || rawPrice === '') {
      validationErrors.push('El precio (Lista1) está vacío.');
    } else {
      precio = Number(rawPrice);
      if (isNaN(precio)) {
        validationErrors.push(`El precio "${rawPrice}" no es numérico.`);
      }
    }

    // Validación de stock
    let stock = 0;
    if (rawStock === undefined || rawStock === null || rawStock === '') {
      validationErrors.push('El stock está vacío.');
    } else {
      stock = Number(rawStock);
      if (isNaN(stock)) {
        validationErrors.push(`El stock "${rawStock}" no es numérico.`);
      }
    }

    // Si hay errores críticos de datos inválidos, se marca como error
    if (validationErrors.length > 0) {
      stagedRows.push({
        filaNumero,
        codigo: code || String(rawCode || ''),
        descripcion: desc || String(rawDesc || ''),
        marca: brand,
        precio: isNaN(precio) ? 0 : precio,
        stock: isNaN(stock) ? 0 : stock,
        estado: 'error',
        conflictReason: 'invalid_data',
        validationErrors,
      });
      return;
    }

    const normCode = code.toLowerCase();
    const normDesc = normalizeText(desc);
    const normBrand = normalizeText(brand);

    // 1. Buscar coincidencia por nombre/descripción normalizado (y marca si coincide)
    const matchesByDesc = existingProducts.filter((p) => {
      const pNormDesc = normalizeText(p.nombre);
      return pNormDesc === normDesc;
    });

    // 2. Buscar coincidencia por código de barras / código comercial
    const productByCode = existingProducts.find(
      (p) => normalizeCode(p.codigo).toLowerCase() === normCode
    );

    // ────────────────────────────────────────────────────────
    // PRIORIDAD 1: Coincidencia directa por NOMBRE (mismo producto)
    // ────────────────────────────────────────────────────────
    if (matchesByDesc.length > 0) {
      // Elegir el mejor producto coincidente (priorizar si coincide la marca)
      let matchedProd = matchesByDesc[0];
      if (normBrand && matchesByDesc.length > 1) {
        const brandMatch = matchesByDesc.find(p => normalizeText(p.marca) === normBrand);
        if (brandMatch) matchedProd = brandMatch;
      }

      const existingProdCode = normalizeCode(matchedProd.codigo).toLowerCase();
      const isNewCode = existingProdCode !== normCode;

      // Si el código cambió o es nuevo, actualiza el código en el catálogo; de lo contrario actualiza por código
      const action = isNewCode ? 'replace_code' : 'update_by_code';

      stagedRows.push({
        filaNumero,
        codigo: code,
        descripcion: desc,
        marca: brand || matchedProd.marca || '',
        precio,
        stock,
        estado: 'ready',
        action,
        matchedProductId: matchedProd.id,
        matchedProductName: matchedProd.nombre,
        matchedProductCode: matchedProd.codigo,
        matchedProductPrice: matchedProd.precio,
        matchedProductStock: matchedProd.stock ?? 0,
        matchedProductBrand: matchedProd.marca,
      });
      return;
    }

    // ────────────────────────────────────────────────────────
    // PRIORIDAD 2: Coincidencia por CÓDIGO (mismo código existente)
    // ────────────────────────────────────────────────────────
    if (productByCode) {
      stagedRows.push({
        filaNumero,
        codigo: code,
        descripcion: desc,
        marca: brand || productByCode.marca || '',
        precio,
        stock,
        estado: 'ready',
        action: 'update_by_code',
        matchedProductId: productByCode.id,
        matchedProductName: productByCode.nombre,
        matchedProductCode: productByCode.codigo,
        matchedProductPrice: productByCode.precio,
        matchedProductStock: productByCode.stock ?? 0,
        matchedProductBrand: productByCode.marca,
      });
      return;
    }

    // ────────────────────────────────────────────────────────
    // PRIORIDAD 3: Producto totalmente nuevo (creación)
    // ────────────────────────────────────────────────────────
    stagedRows.push({
      filaNumero,
      codigo: code,
      descripcion: desc,
      marca: brand,
      precio,
      stock,
      estado: 'ready',
      action: 'create_new',
    });
  });

  return stagedRows;
}
