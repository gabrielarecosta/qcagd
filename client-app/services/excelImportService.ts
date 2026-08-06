// ============================================================
// SERVICIO DE IMPORTACIÓN EXCEL
// Usa expo-document-picker + expo-file-system + SheetJS (xlsx)
// ============================================================
// En Etapa 2, este servicio subirá el archivo a Supabase Storage
// y procesará la importación en el backend.
// ============================================================

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';

import { Product, ImportPreview, ImportRowError } from '../types';
import {
  checkRequiredColumns,
  normalizeRow,
  validateRow,
  rowToProduct,
  detectDuplicates,
} from '../utils/productValidator';

// Tipos MIME aceptados
const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                           // .xls
  'text/csv',                                                            // .csv
  'text/comma-separated-values',
  '*/*', // fallback para Android
];

export interface PickedFile {
  uri: string;
  name: string;
  size?: number;
}

/**
 * Abre el selector de archivos del dispositivo.
 * Retorna el archivo seleccionado, o null si el usuario canceló.
 */
export async function pickExcelFile(): Promise<PickedFile | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_TYPES,
      copyToCacheDirectory: true, // Necesario para leer el archivo en Android
    });

    if (result.canceled) return null;

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      name: asset.name,
      size: asset.size,
    };
  } catch (error) {
    throw new Error('No se pudo abrir el selector de archivos');
  }
}

/**
 * Lee y parsea un archivo Excel/CSV desde su URI.
 * Retorna las filas como array de objetos (clave = encabezado).
 */
async function parseFile(uri: string): Promise<{
  headers: string[];
  rows: Record<string, unknown>[];
}> {
  // Leer el archivo como base64
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Parsear con SheetJS
  const workbook = XLSX.read(base64, { type: 'base64' });

  if (workbook.SheetNames.length === 0) {
    throw new Error('El archivo no contiene hojas de cálculo');
  }

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convertir a JSON (primera fila = encabezados)
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',       // Valor por defecto para celdas vacías
    raw: false,       // Todos los valores como strings
  });

  if (rawRows.length === 0) {
    throw new Error('El archivo está vacío o no tiene filas de datos');
  }

  // Extraer encabezados de la primera fila
  const headers = Object.keys(rawRows[0]);

  return { headers, rows: rawRows };
}

/**
 * Función principal: procesa un archivo completo y devuelve la preview.
 *
 * @param file - Archivo seleccionado por pickExcelFile()
 * @returns ImportPreview con productos válidos, errores y duplicados
 *
 * En Etapa 2: reemplazar este método por una llamada a la API de Supabase
 * que procese el archivo en el backend para mejor rendimiento con 6000+ filas.
 */
export async function processExcelFile(file: PickedFile): Promise<ImportPreview> {
  // 1. Parsear el archivo
  const { headers, rows } = await parseFile(file.uri);

  // 2. Verificar columnas obligatorias
  const missingColumns = checkRequiredColumns(headers);
  if (missingColumns.length > 0) {
    throw new Error(
      `Columnas obligatorias faltantes: ${missingColumns.join(', ')}.\n` +
      `Asegurate de que el archivo tenga estas columnas: codigo, nombre, categoria, presentacion`
    );
  }

  // 3. Validar y transformar cada fila
  const validProducts: Product[] = [];
  const errors: ImportRowError[] = [];

  rows.forEach((rawRow, index) => {
    const filaNro = index + 2; // +2 porque la fila 1 es el encabezado
    const row = normalizeRow(rawRow as Record<string, unknown>);
    const rowErrors = validateRow(row, filaNro);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      validProducts.push(rowToProduct(row, index));
    }
  });

  // 4. Detectar duplicados entre los productos válidos
  const duplicados = detectDuplicates(validProducts);

  return {
    fileName: file.name,
    totalFilas: rows.length,
    productosValidos: validProducts,
    errores: errors,
    duplicados,
  };
}

/**
 * Formato esperado del Excel como string Markdown.
 * Se muestra en el modal de ayuda de la pantalla de importación.
 */
export const EXCEL_FORMAT_HELP = {
  columns: [
    { nombre: 'codigo', requerida: true, tipo: 'Texto', ejemplo: 'LIM-001', descripcion: 'Código único del artículo' },
    { nombre: 'nombre', requerida: true, tipo: 'Texto', ejemplo: 'Lavandina Concentrada', descripcion: 'Nombre del producto' },
    { nombre: 'categoria', requerida: true, tipo: 'Texto', ejemplo: 'Limpieza', descripcion: 'Una de las 8 categorías válidas' },
    { nombre: 'presentacion', requerida: true, tipo: 'Texto', ejemplo: 'Bidón 5L', descripcion: 'Formato o presentación del producto' },
    { nombre: 'precio', requerida: false, tipo: 'Número', ejemplo: '1250', descripcion: 'Precio unitario en pesos' },
    { nombre: 'stock', requerida: false, tipo: 'Número entero', ejemplo: '100', descripcion: 'Cantidad en stock' },
    { nombre: 'unidad', requerida: false, tipo: 'Texto', ejemplo: 'litro', descripcion: 'Unidad de medida' },
    { nombre: 'descripcion', requerida: false, tipo: 'Texto', ejemplo: 'Lavandina 10° concentrada...', descripcion: 'Descripción opcional' },
  ],
  categoriasValidas: [
    'Limpieza', 'Químicos', 'Perfumería', 'Descartables',
    'Piscina', 'Industrial', 'Hogar', 'Institucional',
  ],
  notas: [
    'La primera fila debe contener los nombres de las columnas',
    'Los nombres de columnas no distinguen mayúsculas ni acentos',
    'Los productos con código repetido generarán una advertencia',
    'Se importan solo los productos sin errores',
  ],
};
