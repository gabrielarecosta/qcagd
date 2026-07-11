import { REQUIRED_COLUMNS, normalizeHeader } from './productValidator';

export interface ExcelValidationError {
  tipo: 'error_columnas' | 'error_fila';
  mensaje: string;
}

export function validateExcelHeaders(headers: string[]): ExcelValidationError | null {
  const normalized = headers.map(normalizeHeader);
  const missing = REQUIRED_COLUMNS.filter(req => !normalized.includes(req));

  if (missing.length > 0) {
    return {
      tipo: 'error_columnas',
      mensaje: `Faltan las columnas obligatorias: ${missing.join(', ')}`,
    };
  }

  return null;
}
