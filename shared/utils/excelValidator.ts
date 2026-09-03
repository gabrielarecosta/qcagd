export interface ExcelValidationError {
  tipo: 'error_columnas' | 'error_fila';
  mensaje: string;
}

export interface HeaderIndexes {
  codeIdx: number;
  descIdx: number;
  brandIdx: number;
  priceIdx: number;
  stockIdx: number;
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
 */
export function findHeaderIndexes(headers: any[]): HeaderIndexes {
  let codeIdx = -1;
  let descIdx = -1;
  let brandIdx = -1;
  let priceIdx = -1;
  let stockIdx = -1;

  if (Array.isArray(headers)) {
    headers.forEach((h, idx) => {
      if (h === undefined || h === null) return;
      const norm = normalizeHeaderString(h);

      if (codeIdx === -1 && (norm.includes('codigo') || norm.includes('sku') || norm === 'cod' || norm.includes('articulo_id') || norm.includes('clave'))) {
        codeIdx = idx;
      } else if (descIdx === -1 && (norm.includes('descripcion') || norm.includes('nombre') || norm.includes('producto') || norm.includes('detalle') || norm.includes('articulo'))) {
        descIdx = idx;
      } else if (brandIdx === -1 && (norm.includes('marca') || norm.includes('fabricante') || norm.includes('brand'))) {
        brandIdx = idx;
      } else if (priceIdx === -1 && (norm.includes('lista1') || norm.includes('precio') || norm.includes('pvp') || norm.includes('p.venta') || norm.includes('importe') || norm.includes('costo'))) {
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
  if (priceIdx === -1) priceIdx = 5;
  if (stockIdx === -1) stockIdx = 6;

  return { codeIdx, descIdx, brandIdx, priceIdx, stockIdx };
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
  const hasCode = normHeaders.some(h => h.includes('codigo') || h.includes('sku') || h === 'cod' || h.includes('clave'));
  const hasDesc = normHeaders.some(h => h.includes('descripcion') || h.includes('nombre') || h.includes('producto') || h.includes('articulo') || h.includes('detalle'));
  const hasPrice = normHeaders.some(h => h.includes('lista1') || h.includes('precio') || h.includes('pvp') || h.includes('importe') || h.includes('p.venta'));

  const missing: string[] = [];
  if (!hasCode && indexes.codeIdx === -1) missing.push('Código (ej: Codigo, SKU)');
  if (!hasDesc && indexes.descIdx === -1) missing.push('Descripción / Nombre (ej: Descripcion, Nombre)');
  if (!hasPrice && indexes.priceIdx === -1) missing.push('Precio (ej: Lista1, Precio)');

  if (missing.length > 0) {
    return {
      tipo: 'error_columnas',
      mensaje: `Faltan columnas obligatorias requeridas: ${missing.join(', ')}. Las columnas detectadas en el archivo son: [${headers.filter(Boolean).join(', ')}].`,
    };
  }

  return null;
}
