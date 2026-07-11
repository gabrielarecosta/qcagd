export interface ExcelValidationError {
  tipo: 'error_columnas' | 'error_fila';
  mensaje: string;
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
 * Valida que los encabezados del archivo Excel correspondan a:
 * A1 = Codigo
 * C1 = Descripcion
 * D1 = Marca
 * F1 = Lista1
 * G1 = Stock
 */
export function validateExcelHeaders(headers: any[]): ExcelValidationError | null {
  if (!headers || headers.length < 7) {
    return {
      tipo: 'error_columnas',
      mensaje: `El archivo debe tener al menos 7 columnas (A a G). Columnas encontradas: ${headers ? headers.length : 0}`,
    };
  }

  const expected: Record<number, { col: string; expected: string; label: string }> = {
    0: { col: 'A', expected: 'codigo', label: 'Codigo' },
    2: { col: 'C', expected: 'descripcion', label: 'Descripcion' },
    3: { col: 'D', expected: 'marca', label: 'Marca' },
    5: { col: 'F', expected: 'lista1', label: 'Lista1' },
    6: { col: 'G', expected: 'stock', label: 'Stock' }
  };

  for (const [idxStr, info] of Object.entries(expected)) {
    const idx = parseInt(idxStr);
    const value = headers[idx];
    const norm = normalizeHeaderString(value);
    
    if (norm !== info.expected) {
      return {
        tipo: 'error_columnas',
        mensaje: `La cabecera de la columna ${info.col}1 debe ser "${info.label}" (se encontró: "${value || 'vacía'}").`,
      };
    }
  }

  return null;
}
