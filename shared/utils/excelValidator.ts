export interface ExcelValidationError {
  tipo: 'error_columnas' | 'error_fila';
  mensaje: string;
}

export interface HeaderIndexes {
  codeIdx: number;
  descIdx: number;
  brandIdx: number;
  priceIdx: number;           // Lista 1 (Minorista / Público general)
  stockIdx: number;           // Stock físico
  priceMayoristaIdx: number;  // Lista 3 (Mayoristas chicos)
  priceSociosIdx: number;     // Lista 4 (Socios)
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
 * Detecta automáticamente qué fila del archivo Excel contiene los encabezados reales,
 * buscando en las primeras 10 filas aquella con más coincidencias de palabras clave comerciales.
 * Esto evita errores si el archivo tiene títulos de empresa, fechas o filas vacías al inicio.
 */
export function detectHeaderRowIndex(rawRows: any[][]): number {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return 0;

  const keywords = [
    'codigo', 'cod', 'sku', 'clave', 'articulo',
    'descripcion', 'nombre', 'producto', 'detalle', 'item',
    'marca', 'fabricante',
    'precio', 'lista1', 'minorista', 'publico', 'pvp',
    'stock', 'cantidad', 'cant', 'existencia', 'inventario',
    'lista3', 'mayorista',
    'lista4', 'socio'
  ];

  let bestRowIdx = 0;
  let maxScore = 0;

  const maxRowsToScan = Math.min(rawRows.length, 10);
  for (let r = 0; r < maxRowsToScan; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    let score = 0;
    row.forEach(cell => {
      if (cell === undefined || cell === null) return;
      const norm = normalizeHeaderString(cell);
      if (!norm) return;
      if (keywords.some(k => norm.includes(k))) {
        score++;
      }
    });

    if (score > maxScore) {
      maxScore = score;
      bestRowIdx = r;
    }
  }

  // Si encontró al menos 2 palabras clave, asume esa fila como encabezado; sino, usa la fila 0 por defecto
  return maxScore >= 2 ? bestRowIdx : 0;
}

/**
 * Busca de forma dinámica e inteligente la posición de todas las columnas (las existentes y las nuevas)
 * en el archivo Excel, priorizando coincidencia por nombre de encabezado y con fallbacks posicionales.
 * Columnas soportadas:
 * - Código: Col A o encabezado Código / SKU / Articulo / Cod
 * - Descripción: Col C o Col B o encabezado Descripción / Nombre / Producto
 * - Marca: Col D o Col C o encabezado Marca / Fabricante
 * - Lista 1 (Minorista / Público general): Col F o Col D o encabezado Lista 1 / Precio / Minorista
 * - Stock: Col G o Col E o encabezado Stock / Cantidad
 * - Lista 3 (Mayoristas): Col H/I o encabezado Lista 3 / Mayorista
 * - Lista 4 (Socios): Col I/J o encabezado Lista 4 / Socios
 */
export function findHeaderIndexes(headers: any[]): HeaderIndexes {
  let codeIdx = -1;
  let descIdx = -1;
  let brandIdx = -1;
  let priceIdx = -1;
  let stockIdx = -1;
  let priceMayoristaIdx = -1;
  let priceSociosIdx = -1;

  if (Array.isArray(headers) && headers.length > 0) {
    const normHeaders = headers.map(h => normalizeHeaderString(h));

    // ─────────────────────────────────────────────────────────────
    // 1. DETECCIÓN POR NOMBRE DE ENCABEZADO (MÁXIMA PRIORIDAD)
    // ─────────────────────────────────────────────────────────────
    
    // A. Lista 3 (Mayorista chicos)
    normHeaders.forEach((norm, idx) => {
      if (!norm) return;
      if (priceMayoristaIdx === -1 && (
        norm.includes('lista3') ||
        norm.includes('lista_3') ||
        norm === 'l3' ||
        norm.includes('preciomayorista') ||
        norm.includes('p.mayorista') ||
        (norm.includes('mayorista') && !norm.includes('solicitud'))
      )) {
        priceMayoristaIdx = idx;
      }
    });

    // B. Lista 4 (Socios)
    normHeaders.forEach((norm, idx) => {
      if (!norm) return;
      if (priceSociosIdx === -1 && (
        norm.includes('lista4') ||
        norm.includes('lista_4') ||
        norm === 'l4' ||
        norm.includes('preciosocio') ||
        norm.includes('p.socio') ||
        norm.includes('socio') ||
        norm.includes('socios')
      )) {
        priceSociosIdx = idx;
      }
    });

    // C. Lista 1 (Minorista / Público general)
    normHeaders.forEach((norm, idx) => {
      if (!norm || idx === priceMayoristaIdx || idx === priceSociosIdx) return;
      if (priceIdx === -1 && (
        norm.includes('lista1') ||
        norm.includes('lista_1') ||
        norm === 'l1' ||
        norm.includes('minorista') ||
        norm.includes('publico') ||
        norm.includes('pvp') ||
        norm.includes('p.venta') ||
        norm.includes('precioventa') ||
        norm.includes('preciominorista')
      )) {
        priceIdx = idx;
      }
    });

    // D. Precio genérico (si Lista 1 aún no se detectó y no es costo ni otra lista)
    if (priceIdx === -1) {
      normHeaders.forEach((norm, idx) => {
        if (!norm || idx === priceMayoristaIdx || idx === priceSociosIdx) return;
        if (priceIdx === -1 && (
          norm.includes('precio') ||
          norm.includes('importe') ||
          norm.includes('precio1')
        ) && !norm.includes('costo') && !norm.includes('mayorista') && !norm.includes('socio') && !norm.includes('lista2') && !norm.includes('lista3') && !norm.includes('lista4')) {
          priceIdx = idx;
        }
      });
    }

    // E. Código de producto
    normHeaders.forEach((norm, idx) => {
      if (!norm || idx === priceIdx || idx === priceMayoristaIdx || idx === priceSociosIdx) return;
      if (codeIdx === -1 && (
        norm.includes('codigo') ||
        norm.includes('sku') ||
        norm === 'cod' ||
        norm.includes('articulo_id') ||
        norm.includes('clave') ||
        norm === 'art' ||
        norm === 'codart' ||
        norm === 'articulo' ||
        norm === 'id'
      )) {
        codeIdx = idx;
      }
    });

    // F. Descripción / Nombre
    normHeaders.forEach((norm, idx) => {
      if (!norm || idx === codeIdx || idx === priceIdx || idx === priceMayoristaIdx || idx === priceSociosIdx) return;
      if (descIdx === -1 && (
        norm.includes('descripcion') ||
        norm.includes('nombre') ||
        norm.includes('producto') ||
        norm.includes('detalle') ||
        norm.includes('denominacion') ||
        norm.includes('articulo') ||
        norm === 'desc' ||
        norm === 'item'
      )) {
        descIdx = idx;
      }
    });

    // G. Marca
    normHeaders.forEach((norm, idx) => {
      if (!norm || idx === codeIdx || idx === descIdx || idx === priceIdx || idx === priceMayoristaIdx || idx === priceSociosIdx) return;
      if (brandIdx === -1 && (
        norm.includes('marca') ||
        norm.includes('fabricante') ||
        norm.includes('brand') ||
        norm.includes('proveedor') ||
        norm.includes('rubro') ||
        norm.includes('linea')
      )) {
        brandIdx = idx;
      }
    });

    // H. Stock
    normHeaders.forEach((norm, idx) => {
      if (!norm || idx === codeIdx || idx === descIdx || idx === brandIdx || idx === priceIdx || idx === priceMayoristaIdx || idx === priceSociosIdx) return;
      if (stockIdx === -1 && (
        norm.includes('stock') ||
        norm.includes('cantidad') ||
        norm.includes('cant') ||
        norm.includes('existencia') ||
        norm.includes('inventario') ||
        norm.includes('unidades') ||
        norm.includes('disp') ||
        norm.includes('disponible')
      )) {
        stockIdx = idx;
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 2. FALLBACKS POSICIONALES (si no vinieron nombres en encabezados)
    // ─────────────────────────────────────────────────────────────
    
    // Formato ERP tradicional (Col A=0, Col C=2, Col D=3, Col F=5, Col G=6, Col H/I=7/8, Col I/J=8/9)
    if (codeIdx === -1) codeIdx = 0;
    
    if (descIdx === -1) {
      if (headers.length > 2 && headers[2] !== undefined) descIdx = 2;
      else if (headers.length > 1) descIdx = 1;
      else descIdx = 0;
    }

    if (brandIdx === -1) {
      if (headers.length > 3 && headers[3] !== undefined) brandIdx = 3;
    }

    if (priceIdx === -1) {
      if (headers.length > 5) priceIdx = 5;
      else if (headers.length > 3) priceIdx = 3;
    }

    if (stockIdx === -1) {
      if (headers.length > 6) stockIdx = 6;
      else if (headers.length > 4) stockIdx = 4;
    }

    // Lista 3 fallback (si hay columnas adicionales después de stock)
    if (priceMayoristaIdx === -1) {
      if (headers.length > 8) priceMayoristaIdx = 8;
      else if (headers.length > 7 && stockIdx !== 7) priceMayoristaIdx = 7;
    }

    // Lista 4 fallback (si hay columnas adicionales después de Lista 3)
    if (priceSociosIdx === -1) {
      if (headers.length > 9) priceSociosIdx = 9;
      else if (headers.length > 8 && priceMayoristaIdx !== 8 && stockIdx !== 8) priceSociosIdx = 8;
    }
  } else {
    // Valores base si headers está completamente vacío
    codeIdx = 0;
    descIdx = 2;
    brandIdx = 3;
    priceIdx = 5;
    stockIdx = 6;
    priceMayoristaIdx = 8;
    priceSociosIdx = 9;
  }

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
  const hasCode = indexes.codeIdx !== -1 || normHeaders.some(h => h.includes('codigo') || h.includes('sku') || h === 'cod' || h.includes('clave') || h === 'articulo');
  const hasDesc = indexes.descIdx !== -1 || normHeaders.some(h => h.includes('descripcion') || h.includes('nombre') || h.includes('producto') || h.includes('articulo') || h.includes('detalle'));
  const hasPrice = indexes.priceIdx !== -1 || normHeaders.some(h => h.includes('lista1') || h.includes('minorista') || h.includes('publico') || h.includes('precio') || h.includes('pvp') || h.includes('importe') || h.includes('p.venta')) || headers.length >= 4;

  const missing: string[] = [];
  if (!hasCode) missing.push('Código (ej: Codigo, SKU, Cod)');
  if (!hasDesc) missing.push('Descripción / Nombre (ej: Descripcion, Nombre)');
  if (!hasPrice) missing.push('Precio / Lista 1 (Minorista)');

  if (missing.length > 0) {
    return {
      tipo: 'error_columnas',
      mensaje: `Faltan columnas obligatorias requeridas: ${missing.join(', ')}. Las columnas detectadas en el archivo son: [${headers.filter(Boolean).join(', ')}].`,
    };
  }

  return null;
}
