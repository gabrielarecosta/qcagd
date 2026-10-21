export interface ExcelValidationError {
  tipo: 'error_columnas' | 'error_fila';
  mensaje: string;
}

export interface HeaderIndexes {
  codeIdx: number;
  descIdx: number;
  brandIdx: number;
  priceIdx: number;           // Columna F (índice 5 base 0) - Lista 1 (Minorista / Público general)
  stockIdx: number;           // Columna G (índice 6 base 0) - Stock
  priceMayoristaIdx: number;  // Columna I (índice 8 base 0) - Lista 3 (Mayoristas chicos)
  priceSociosIdx: number;     // Columna J (índice 9 base 0) - Lista 4 (Socios)
}

function normalizeHeaderString(s: any): string {
  if (s === undefined || s === null) return '';
  return String(s)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');
}

/**
 * Busca de forma dinámica la posición de las columnas obligatorias y opcionales
 * en el archivo Excel, ignorando el orden o columnas extra.
 * - Lista 1 (Público general / minoristas): Columna F (índice 5)
 * - Lista 3 (Mayoristas chicos): Columna I (índice 8)
 * - Lista 4 (Socios): Columna J (índice 9)
 */
export function findHeaderIndexes(headers: any[]): HeaderIndexes {
  let codeIdx = -1;
  let descIdx = -1;
  let brandIdx = -1;
  let priceIdx = -1;
  let stockIdx = -1;
  let priceMayoristaIdx = -1;
  let priceSociosIdx = -1;

  if (Array.isArray(headers)) {
    // 1. Prioridad máxima para precio minorista (Lista 1): Columna F (índice 5 en base 0)
    if (headers.length > 5) {
      const normF = normalizeHeaderString(headers[5]);
      if (
        normF.includes('lista1') ||
        normF.includes('lista') ||
        normF.includes('minorista') ||
        normF.includes('precio') ||
        normF.includes('publico') ||
        normF.includes('pvp') ||
        normF === ''
      ) {
        priceIdx = 5;
      }
    }

    // 2. Prioridad para precio mayorista chicos (Lista 3): Columna I (índice 8 en base 0)
    if (headers.length > 8) {
      const normI = normalizeHeaderString(headers[8]);
      if (
        normI.includes('lista3') ||
        normI.includes('mayorista') ||
        normI.includes('l3') ||
        normI === ''
      ) {
        priceMayoristaIdx = 8;
      }
    }

    // 3. Prioridad para precio socios (Lista 4): Columna J (índice 9 en base 0)
    if (headers.length > 9) {
      const normJ = normalizeHeaderString(headers[9]);
      if (
        normJ.includes('lista4') ||
        normJ.includes('socio') ||
        normJ.includes('socios') ||
        normJ.includes('l4') ||
        normJ === ''
      ) {
        priceSociosIdx = 9;
      }
    }

    // 4. Si no se detectaron en sus columnas exactas, buscar por coincidencia en texto
    headers.forEach((h, idx) => {
      if (h === undefined || h === null) return;
      const norm = normalizeHeaderString(h);
      if (priceIdx === -1 && (norm.includes('lista1') || norm.includes('lista_1') || norm === 'l1')) {
        priceIdx = idx;
      }
      if (priceMayoristaIdx === -1 && (norm.includes('lista3') || norm.includes('lista_3') || norm === 'l3' || (norm.includes('mayorista') && !norm.includes('solicitud')))) {
        priceMayoristaIdx = idx;
      }
      if (priceSociosIdx === -1 && (norm.includes('lista4') || norm.includes('lista_4') || norm === 'l4' || norm.includes('socio') || norm.includes('socios'))) {
        priceSociosIdx = idx;
      }
    });

    // 5. Buscar el resto de las columnas (código, descripción, marca, stock)
    headers.forEach((h, idx) => {
      if (h === undefined || h === null) return;
      const norm = normalizeHeaderString(h);

      if (codeIdx === -1 && (norm.includes('codigo') || norm.includes('sku') || norm === 'cod' || norm.includes('articulo_id') || norm.includes('clave'))) {
        codeIdx = idx;
      } else if (descIdx === -1 && (norm.includes('descripcion') || norm.includes('nombre') || norm.includes('producto') || norm.includes('detalle') || norm.includes('articulo'))) {
        descIdx = idx;
      } else if (brandIdx === -1 && (norm.includes('marca') || norm.includes('fabricante') || norm.includes('brand'))) {
        brandIdx = idx;
      } else if (priceIdx === -1 && (
        norm.includes('minorista') || 
        norm.includes('publico') || 
        norm.includes('pvp') || 
        norm.includes('p.venta') || 
        norm.includes('precio') || 
        norm.includes('importe')
      ) && !norm.includes('costo') && !norm.includes('mayorista') && !norm.includes('lista2') && !norm.includes('lista3') && !norm.includes('lista4') && !norm.includes('socio')) {
        priceIdx = idx;
      } else if (stockIdx === -1 && (norm.includes('stock') || norm.includes('cantidad') || norm.includes('cant') || norm.includes('existencia') || norm.includes('inventario'))) {
        stockIdx = idx;
      }
    });
  }

  // Fallbacks posicionales por defecto si la primera fila no traía nombres explícitos
  if (codeIdx === -1) codeIdx = 0;
  if (descIdx === -1) descIdx = 2;
  if (brandIdx === -1) brandIdx = 3;
  if (priceIdx === -1) priceIdx = 5; // Columna F por defecto (índice 5: Lista 1 precio minorista)
  if (stockIdx === -1) stockIdx = 6;
  if (priceMayoristaIdx === -1 && Array.isArray(headers) && headers.length > 8) priceMayoristaIdx = 8; // Columna I (índice 8: Lista 3 mayoristas)
  if (priceSociosIdx === -1 && Array.isArray(headers) && headers.length > 9) priceSociosIdx = 9; // Columna J (índice 9: Lista 4 socios)

  return { codeIdx, descIdx, brandIdx, priceIdx, stockIdx, priceMayoristaIdx, priceSociosIdx };
}

/**
 * Valida únicamente que existan las columnas MÍNIMAS obligatorias (Código, Descripción, Precio).
 * Las columnas extras son totalmente ignoradas.
 */
export function validateExcelHeaders(headers: any[]): ExcelValidationError | null {
  if (!headers || headers.length === 0) {
    return {
      tipo: 'error_columnas',
      mensaje: 'El archivo Excel está vacío o no se pudieron leer sus encabezados.',
    };
  }

  const indexes = findHeaderIndexes(headers);
  const normHeaders = headers.map(normalizeHeaderString);

  // Verificar si la columna de código está en algún encabezado
  const hasCode = normHeaders.some(h => h.includes('codigo') || h.includes('sku') || h === 'cod' || h.includes('clave')) || indexes.codeIdx !== -1;
  const hasDesc = normHeaders.some(h => h.includes('descripcion') || h.includes('nombre') || h.includes('producto') || h.includes('articulo') || h.includes('detalle')) || indexes.descIdx !== -1;
  const hasPrice = normHeaders.some(h => h.includes('lista1') || h.includes('minorista') || h.includes('publico') || h.includes('precio') || h.includes('pvp') || h.includes('importe') || h.includes('p.venta')) || indexes.priceIdx !== -1 || headers.length >= 6;

  const missing: string[] = [];
  if (!hasCode) missing.push('Código (ej: Codigo, SKU)');
  if (!hasDesc) missing.push('Descripción / Nombre (ej: Descripcion, Nombre)');
  if (!hasPrice) missing.push('Precio Minorista / Lista 1 (Columna F)');

  if (missing.length > 0) {
    return {
      tipo: 'error_columnas',
      mensaje: `Faltan columnas obligatorias requeridas: ${missing.join(', ')}. Las columnas detectadas en el archivo son: [${headers.filter(Boolean).join(', ')}].`,
    };
  }

  return null;
}
