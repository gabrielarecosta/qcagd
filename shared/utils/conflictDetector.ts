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

    // Buscar si existe un producto con el mismo código en la base de datos
    const productByCode = existingProducts.find(
      (p) => normalizeCode(p.codigo).toLowerCase() === normCode
    );

    // Buscar si existen productos con la misma descripción (y marca si está presente)
    const matchesByDesc = existingProducts.filter((p) => {
      const pNormDesc = normalizeText(p.nombre);
      if (normBrand) {
        const pNormBrand = normalizeText(p.marca);
        return pNormDesc === normDesc && pNormBrand === normBrand;
      }
      return pNormDesc === normDesc;
    });

    const isDuplicateInExcel = (excelDescCounts[normDesc] || 0) > 1;

    // ────────────────────────────────────────────────────────
    // CASO 1: El código de barras ya existe en la base de datos
    // ────────────────────────────────────────────────────────
    if (productByCode) {
      // Conflicto: Split match (el código coincide con un producto, pero la descripción coincide con otro)
      const matchesOtherDesc = matchesByDesc.find((p) => p.id !== productByCode.id);
      
      if (matchesOtherDesc) {
        stagedRows.push({
          filaNumero,
          codigo: code,
          descripcion: desc,
          marca: brand,
          precio,
          stock,
          estado: 'requires_review',
          action: 'update_by_code',
          conflictReason: 'split_match',
          validationErrors: [
            `El código coincide con "${productByCode.nombre}", pero la descripción coincide con "${matchesOtherDesc.nombre}".`
          ],
          matchedProductId: productByCode.id,
          matchedProductName: productByCode.nombre,
          matchedProductCode: productByCode.codigo,
          matchedProductPrice: productByCode.precio,
          matchedProductStock: productByCode.stock ?? 0,
          matchedProductBrand: productByCode.marca,
        });
        return;
      }

      // Proceso normal: Actualizar producto existente por su código
      stagedRows.push({
        filaNumero,
        codigo: code,
        descripcion: desc,
        marca: brand,
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
    // CASO 2: El código no existe, pero la descripción coincide
    // ────────────────────────────────────────────────────────
    if (matchesByDesc.length > 0) {
      // Conflicto: Más de un producto existente con la misma descripción
      if (matchesByDesc.length > 1) {
        stagedRows.push({
          filaNumero,
          codigo: code,
          descripcion: desc,
          marca: brand,
          precio,
          stock,
          estado: 'requires_review',
          action: 'replace_code',
          conflictReason: 'multiple_descriptions_exist',
          validationErrors: ['Existen múltiples productos en la base de datos con esta misma descripción.'],
        });
        return;
      }

      // Conflicto: La misma descripción aparece varias veces en el Excel con códigos distintos
      if (isDuplicateInExcel) {
        stagedRows.push({
          filaNumero,
          codigo: code,
          descripcion: desc,
          marca: brand,
          precio,
          stock,
          estado: 'requires_review',
          action: 'replace_code',
          conflictReason: 'duplicate_description_in_excel',
          validationErrors: ['Esta descripción se repite en el archivo Excel con diferentes códigos.'],
        });
        return;
      }

      const matchedProd = matchesByDesc[0];

      // Conflicto: La descripción coincide pero las marcas son diferentes
      const matchedProdNormBrand = normalizeText(matchedProd.marca);
      if (normBrand && matchedProdNormBrand && normBrand !== matchedProdNormBrand) {
        stagedRows.push({
          filaNumero,
          codigo: code,
          descripcion: desc,
          marca: brand,
          precio,
          stock,
          estado: 'requires_review',
          action: 'replace_code',
          conflictReason: 'description_matches_different_brand',
          validationErrors: [
            `La descripción coincide, pero la marca del Excel ("${brand}") difiere de la base de datos ("${matchedProd.marca}").`
          ],
          matchedProductId: matchedProd.id,
          matchedProductName: matchedProd.nombre,
          matchedProductCode: matchedProd.codigo,
          matchedProductPrice: matchedProd.precio,
          matchedProductStock: matchedProd.stock ?? 0,
          matchedProductBrand: matchedProd.marca,
        });
        return;
      }

      // Proceso normal: Cambio de código de fábrica
      stagedRows.push({
        filaNumero,
        codigo: code,
        descripcion: desc,
        marca: brand,
        precio,
        stock,
        estado: 'ready',
        action: 'replace_code',
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
    // CASO 3: No existe el código ni la descripción
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
