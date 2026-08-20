/**
 * Catálogo Cartográfico Oficial y Algoritmo de Sugerencias / Fuzzy Matching
 * para la Ciudad de General Deheza, Córdoba, Argentina.
 * Fuente: Plano Oficial de la Municipalidad de General Deheza (generaldeheza.gob.ar)
 */

export interface DehezaStreet {
  name: string;
  type: 'Bulevar' | 'Avenida' | 'Calle' | 'Pasaje';
  altNames: string[];
  approxLat: number;
  approxLng: number;
  zoneHint?: 'Centro' | 'Norte' | 'Sur' | 'Este' | 'Oeste' | 'Industrial';
}

export const DEHEZA_STREETS: DehezaStreet[] = [
  // Bulevares y Avenidas Principales
  { name: 'Bv. San Martín', type: 'Bulevar', altNames: ['San Martin', 'San Maetin', 'Bv San Martin', 'Boulevard San Martin'], approxLat: -32.7561, approxLng: -63.7845, zoneHint: 'Centro' },
  { name: 'Bv. 25 de Mayo', type: 'Bulevar', altNames: ['25 de Mayo', '25 de mayo', 'Bv 25 de Mayo', 'Boulevard 25 de Mayo', '25 de maño'], approxLat: -32.7550, approxLng: -63.7860, zoneHint: 'Centro' },
  { name: 'Bv. Pueyrredón', type: 'Bulevar', altNames: ['Pueyrredon', 'Pueyrredón', 'Bv Pueyrredon'], approxLat: -32.7575, approxLng: -63.7820, zoneHint: 'Centro' },
  { name: 'Av. Buenos Aires', type: 'Avenida', altNames: ['Buenos Aires', 'Av Buenos Aires', 'Avda Buenos Aires'], approxLat: -32.7540, approxLng: -63.7830, zoneHint: 'Norte' },
  { name: 'Av. Córdoba', type: 'Avenida', altNames: ['Cordoba', 'Córdoba', 'Av Cordoba', 'Avda Cordoba'], approxLat: -32.7580, approxLng: -63.7870, zoneHint: 'Sur' },
  { name: 'Av. Almirante Brown', type: 'Avenida', altNames: ['Almirante Brown', 'Brown', 'Av Brown'], approxLat: -32.7535, approxLng: -63.7890, zoneHint: 'Oeste' },
  { name: 'Ruta Nacional 158', type: 'Avenida', altNames: ['Ruta 158', 'RN 158', 'Ruta Nac 158', 'Acceso Norte', 'Acceso Sur'], approxLat: -32.7566, approxLng: -63.7861, zoneHint: 'Industrial' },

  // Calles Zona Centro y Céntricas
  { name: 'General Paz', type: 'Calle', altNames: ['Gral Paz', 'General Paz', 'Paz'], approxLat: -32.7555, approxLng: -63.7840, zoneHint: 'Centro' },
  { name: 'Sarmiento', type: 'Calle', altNames: ['Domingo Faustino Sarmiento', 'Sarmiento', 'Sarmineto'], approxLat: -32.7565, approxLng: -63.7850, zoneHint: 'Centro' },
  { name: 'Rivadavia', type: 'Calle', altNames: ['Bernardino Rivadavia', 'Rivadavia', 'Rivadabia', 'Ribadavia'], approxLat: -32.7558, approxLng: -63.7835, zoneHint: 'Centro' },
  { name: 'Saavedra', type: 'Calle', altNames: ['Cornelio Saavedra', 'Saavedra', 'Savedra'], approxLat: -32.7570, approxLng: -63.7855, zoneHint: 'Centro' },
  { name: 'Belgrano', type: 'Calle', altNames: ['Manuel Belgrano', 'Belgrano', 'Belgranno'], approxLat: -32.7545, approxLng: -63.7848, zoneHint: 'Centro' },
  { name: 'Moreno', type: 'Calle', altNames: ['Mariano Moreno', 'Moreno', 'Moremo'], approxLat: -32.7562, approxLng: -63.7865, zoneHint: 'Centro' },
  { name: '9 de Julio', type: 'Calle', altNames: ['Nueve de Julio', '9 de Julio', '9 de julio'], approxLat: -32.7568, approxLng: -63.7838, zoneHint: 'Centro' },
  { name: 'Libertad', type: 'Calle', altNames: ['Libertad', 'Livertad'], approxLat: -32.7572, approxLng: -63.7842, zoneHint: 'Centro' },
  { name: 'Independencia', type: 'Calle', altNames: ['Independencia', 'Independecia'], approxLat: -32.7552, approxLng: -63.7852, zoneHint: 'Centro' },
  { name: 'Mitre', type: 'Calle', altNames: ['Bartolomé Mitre', 'Mitre'], approxLat: -32.7548, approxLng: -63.7832, zoneHint: 'Centro' },
  { name: 'San Lorenzo', type: 'Calle', altNames: ['San Lorenzo', 'Sn Lorenzo'], approxLat: -32.7578, approxLng: -63.7846, zoneHint: 'Centro' },

  // Calles Zona Norte y Accesos
  { name: 'Liniers', type: 'Calle', altNames: ['Santiago de Liniers', 'Liniers'], approxLat: -32.7490, approxLng: -63.7825, zoneHint: 'Norte' },
  { name: 'French', type: 'Calle', altNames: ['Domingo French', 'French', 'Frenc'], approxLat: -32.7485, approxLng: -63.7835, zoneHint: 'Norte' },
  { name: 'Berutti', type: 'Calle', altNames: ['Antonio Berutti', 'Berutti', 'Beruti'], approxLat: -32.7480, approxLng: -63.7845, zoneHint: 'Norte' },
  { name: 'Alvear', type: 'Calle', altNames: ['Marcelo T. de Alvear', 'Alvear'], approxLat: -32.7475, approxLng: -63.7855, zoneHint: 'Norte' },
  { name: 'Güemes', type: 'Calle', altNames: ['Martin Miguel de Güemes', 'Guemes', 'Güemes'], approxLat: -32.7470, approxLng: -63.7865, zoneHint: 'Norte' },
  { name: 'Dr. René Favaloro', type: 'Calle', altNames: ['René Favaloro', 'Favaloro', 'Dr Favaloro'], approxLat: -32.7460, approxLng: -63.7830, zoneHint: 'Norte' },
  { name: 'Islas Malvinas', type: 'Calle', altNames: ['Malvinas', 'Islas Malvinas', 'Malvinas Argentinas'], approxLat: -32.7450, approxLng: -63.7840, zoneHint: 'Norte' },
  { name: 'Antártida Argentina', type: 'Calle', altNames: ['Antartida', 'Antartida Argentina', 'Antártida Argentina'], approxLat: -32.7445, approxLng: -63.7850, zoneHint: 'Norte' },
  { name: 'Intendente José Frouté', type: 'Calle', altNames: ['Frouté', 'Froute', 'Jose Froute', 'José Frouté', 'Intendente Froute', 'Intendente Frouté', 'Intendente Jose Froute'], approxLat: -32.7530, approxLng: -63.7840, zoneHint: 'Norte' },
  { name: 'Intendente Macario Vicario', type: 'Calle', altNames: ['Vicario', 'Macario Vicario', 'Intendente Vicario'], approxLat: -32.7520, approxLng: -63.7850, zoneHint: 'Norte' },
  { name: 'Intendente Adrián Urquía', type: 'Calle', altNames: ['Urquía', 'Urquia', 'Adrian Urquia', 'Intendente Urquia'], approxLat: -32.7510, approxLng: -63.7860, zoneHint: 'Norte' },
  { name: 'Intendente Bossio', type: 'Calle', altNames: ['Bossio', 'Intendente Bossio'], approxLat: -32.7500, approxLng: -63.7870, zoneHint: 'Norte' },

  // Calles Zona Sur e Industrial
  { name: 'Italia', type: 'Calle', altNames: ['Italia', 'República de Italia'], approxLat: -32.7630, approxLng: -63.7850, zoneHint: 'Sur' },
  { name: 'España', type: 'Calle', altNames: ['España', 'Espana', 'Reino de España'], approxLat: -32.7640, approxLng: -63.7840, zoneHint: 'Sur' },
  { name: 'Entre Ríos', type: 'Calle', altNames: ['Entre Rios', 'Entre Ríos'], approxLat: -32.7650, approxLng: -63.7860, zoneHint: 'Sur' },
  { name: 'Santa Fe', type: 'Calle', altNames: ['Santa Fe', 'Sta Fe'], approxLat: -32.7660, approxLng: -63.7855, zoneHint: 'Sur' },
  { name: 'La Rioja', type: 'Calle', altNames: ['La Rioja', 'Rioja'], approxLat: -32.7670, approxLng: -63.7870, zoneHint: 'Sur' },
  { name: 'Mendoza', type: 'Calle', altNames: ['Mendoza'], approxLat: -32.7680, approxLng: -63.7865, zoneHint: 'Sur' },
  { name: 'Parque Industrial', type: 'Calle', altNames: ['Sector Industrial', 'Parque Agroindustrial', 'Parque Industrial'], approxLat: -32.7710, approxLng: -63.7880, zoneHint: 'Industrial' },

  // Provincias y Próceres
  { name: 'Catamarca', type: 'Calle', altNames: ['Catamarca'], approxLat: -32.7590, approxLng: -63.7810, zoneHint: 'Este' },
  { name: 'Jujuy', type: 'Calle', altNames: ['Jujuy'], approxLat: -32.7595, approxLng: -63.7800, zoneHint: 'Este' },
  { name: 'Salta', type: 'Calle', altNames: ['Salta'], approxLat: -32.7600, approxLng: -63.7790, zoneHint: 'Este' },
  { name: 'Tucumán', type: 'Calle', altNames: ['Tucuman', 'Tucumán'], approxLat: -32.7605, approxLng: -63.7780, zoneHint: 'Este' },
  { name: 'Corrientes', type: 'Calle', altNames: ['Corrientes'], approxLat: -32.7610, approxLng: -63.7770, zoneHint: 'Este' },
  { name: 'Misiones', type: 'Calle', altNames: ['Misiones'], approxLat: -32.7615, approxLng: -63.7760, zoneHint: 'Este' },
  { name: 'Chaco', type: 'Calle', altNames: ['Chaco'], approxLat: -32.7620, approxLng: -63.7750, zoneHint: 'Este' },
  { name: 'Formosa', type: 'Calle', altNames: ['Formosa'], approxLat: -32.7625, approxLng: -63.7740, zoneHint: 'Este' },
  { name: 'Santiago del Estero', type: 'Calle', altNames: ['Santiago del Estero', 'Stgo del Estero'], approxLat: -32.7630, approxLng: -63.7730, zoneHint: 'Este' },
  { name: 'San Juan', type: 'Calle', altNames: ['San Juan', 'Sn Juan'], approxLat: -32.7585, approxLng: -63.7880, zoneHint: 'Oeste' },
  { name: 'San Luis', type: 'Calle', altNames: ['San Luis', 'Sn Luis'], approxLat: -32.7590, approxLng: -63.7890, zoneHint: 'Oeste' },
  { name: 'La Pampa', type: 'Calle', altNames: ['La Pampa', 'Pampa'], approxLat: -32.7595, approxLng: -63.7900, zoneHint: 'Oeste' },
  { name: 'Neuquén', type: 'Calle', altNames: ['Neuquen', 'Neuquén'], approxLat: -32.7600, approxLng: -63.7910, zoneHint: 'Oeste' },
  { name: 'Río Negro', type: 'Calle', altNames: ['Rio Negro', 'Río Negro'], approxLat: -32.7605, approxLng: -63.7920, zoneHint: 'Oeste' },
];

/**
 * Normaliza una cadena quitando acentos, puntuación y espacios extras.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^\w\s]/gi, '') // Quitar símbolos
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Distancia de Levenshtein para medir similitud fonética/ortográfica
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // sustitución
          matrix[i][j - 1] + 1,     // inserción
          matrix[i - 1][j] + 1      // eliminación
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Calcula un puntaje de similitud (0.0 a 1.0) entre dos textos
 */
function calculateSimilarity(input: string, target: string): number {
  const normInput = normalizeText(input);
  const normTarget = normalizeText(target);

  if (normTarget === normInput) return 1.0;
  if (normTarget.startsWith(normInput)) return 0.95;
  if (normTarget.includes(normInput)) return 0.90;

  // Comparación por palabras clave (ej: "froute" con "intendente jose froute")
  const inputWords = normInput.split(' ').filter(w => w.length >= 3);
  const targetWords = normTarget.split(' ').filter(w => w.length >= 3);

  for (const iw of inputWords) {
    for (const tw of targetWords) {
      if (iw === tw) return 0.92;
      if (tw.startsWith(iw) || iw.startsWith(tw)) return 0.88;
      const d = levenshteinDistance(iw, tw);
      if (d <= 1 && Math.max(iw.length, tw.length) >= 4) return 0.82;
    }
  }

  const maxLen = Math.max(normInput.length, normTarget.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(normInput, normTarget);
  const score = 1.0 - distance / maxLen;
  return Math.max(0, score);
}

export interface StreetSuggestion {
  street: DehezaStreet;
  fullAddress: string;
  matchedName: string;
  score: number;
  streetNumber: string;
  latitude: number;
  longitude: number;
}

/**
 * Busca y sugiere calles de General Deheza con autocorrección de errores tipográficos (Fuzzy Matching).
 * Ej: "san maetin 450" -> Sugiere "Bv. San Martín 450, General Deheza" (Score alto)
 */
export function suggestDehezaStreets(rawInput: string, limit = 5): StreetSuggestion[] {
  if (!rawInput || rawInput.trim().length < 2) return [];

  // Extraer número de calle si viene incluido (ej: "san martin 123" -> street: "san martin", number: "123")
  const numberMatch = rawInput.match(/\b\d+\b/);
  const streetNumber = numberMatch ? numberMatch[0] : '';
  const textWithoutNumber = rawInput.replace(/\b\d+\b/g, '').replace(/,/g, '').trim();

  const results: StreetSuggestion[] = [];

  for (const street of DEHEZA_STREETS) {
    let bestScore = calculateSimilarity(textWithoutNumber, street.name);
    let matchedName = street.name;

    for (const alt of street.altNames) {
      const altScore = calculateSimilarity(textWithoutNumber, alt);
      if (altScore > bestScore) {
        bestScore = altScore;
        matchedName = alt;
      }
    }

    if (bestScore > 0.45) {
      const displayAddress = streetNumber
        ? `${street.name} ${streetNumber}, General Deheza, Córdoba`
        : `${street.name}, General Deheza, Córdoba`;

      results.push({
        street,
        fullAddress: displayAddress,
        matchedName,
        score: bestScore,
        streetNumber,
        latitude: street.approxLat,
        longitude: street.approxLng,
      });
    }
  }

  // Ordenar por mayor coincidencia
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
