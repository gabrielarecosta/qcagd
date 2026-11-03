/**
 * Utilidades compartidas para búsqueda de texto indiferente a tildes,
 * mayúsculas, diacríticos y caracteres especiales.
 *
 * Permite que términos como "escobillon" encuentren "Escobillón",
 * "bano" encuentre "CIF BAÑO", "citrico" encuentre "Cítrico", etc.
 */

/**
 * Normaliza un texto para comparaciones en memoria:
 * - Pasa a minúsculas.
 * - Descompone acentos/diacríticos (NFD) y elimina marcas combinadas (\u0300-\u036f).
 * - Convierte 'ñ' en 'n' para que teclados sin 'ñ' o términos sin ella también coincidan.
 * - Elimina espacios redundantes.
 */
export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Comprueba si un texto fuente coincide con una consulta ignorando tildes y mayúsculas.
 * Si la consulta tiene múltiples palabras, todas deben estar presentes en cualquier orden.
 */
export function matchesSearch(source: string | null | undefined, query: string | null | undefined): boolean {
  if (!query || !query.trim()) return true;
  if (!source) return false;

  const normalizedSource = normalizeSearchText(source);
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean);

  if (words.length === 0) return true;
  return words.every(word => normalizedSource.includes(word));
}

/**
 * Comprueba si un conjunto de campos (por ejemplo: nombre, código, descripción, presentación)
 * contiene todas las palabras de la consulta ignorando tildes.
 */
export function matchesAnySearch(
  fields: (string | null | undefined)[],
  query: string | null | undefined
): boolean {
  if (!query || !query.trim()) return true;
  const words = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;

  const combined = fields
    .filter(Boolean)
    .map(f => normalizeSearchText(f))
    .join(' ');

  return words.every(word => combined.includes(word));
}

/**
 * Construye la expresión regular para una sola palabra,
 * mapeando vocales y 'n' a clases de caracteres con y sin acentos.
 */
function buildWordRegex(word: string): string {
  let res = '';
  for (const ch of word) {
    const lower = ch.toLowerCase();
    const unaccented = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (unaccented === 'a') res += '[aáàäâã]';
    else if (unaccented === 'e') res += '[eéèëê]';
    else if (unaccented === 'i') res += '[iíìïî]';
    else if (unaccented === 'o') res += '[oóòöôõ]';
    else if (unaccented === 'u') res += '[uúùüû]';
    else if (unaccented === 'n') res += '[nñ]';
    else if (/[.*+?^${}()|[\]\\-]/.test(ch)) res += '\\' + ch;
    else res += ch;
  }
  return res;
}

/**
 * Construye el patrón regex para PostgreSQL / PostgREST (usando el operador `imatch`)
 * que hace que la búsqueda en Supabase sea indiferente a tildes y diacríticos.
 * - Soporta palabras múltiples en cualquier orden mediante lookaheads (?=.*palabra).
 * - Sanea caracteres especiales de regex para evitar errores de sintaxis en Postgres.
 */
export function buildAccentInsensitivePattern(raw: string | null | undefined): string {
  if (!raw) return '';
  // Eliminar comillas dobles y caracteres de control regex que el usuario pueda escribir accidentalmente
  const clean = String(raw).replace(/["\\()[\]{}+*?^$|]/g, ' ').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return buildWordRegex(words[0]);
  return words.map(w => `(?=.*${buildWordRegex(w)})`).join('');
}

/**
 * Construye una cláusula `.or(...)` de PostgREST para una lista de campos y un texto de búsqueda.
 * Si no se puede generar un patrón regex, retorna cadena vacía.
 */
export function buildSearchOrClause(
  fields: string[],
  query: string | null | undefined
): string {
  const pattern = buildAccentInsensitivePattern(query);
  if (!pattern || fields.length === 0) return '';
  return fields.map(f => `${f}.imatch."${pattern}"`).join(',');
}
