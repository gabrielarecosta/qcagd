export function formatDate(isoString?: string): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' hs';
}

export function formatShortDate(isoString?: string): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '-';

  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Obtiene la fecha actual formateada en YYYY-MM-DD en la zona horaria de Buenos Aires
 */
export function getArgentinaDate(dateInput?: Date): string {
  const date = dateInput || new Date();
  const formatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';
  
  return `${year}-${month}-${day}`;
}

/**
 * Obtiene la hora actual formateada en HH:MM en la zona horaria de Buenos Aires
 */
export function getArgentinaTime(dateInput?: Date): string {
  const date = dateInput || new Date();
  const formatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  return formatter.format(date);
}

/**
 * Obtiene el nombre del día en español (Lunes, Martes, etc.)
 */
export function getArgentinaDayLabel(date: Date): string {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  
  const label = formatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

