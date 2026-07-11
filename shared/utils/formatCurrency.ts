export function formatPrice(value: number): string {
  if (isNaN(value) || value === null || value === undefined) {
    return '$0';
  }
  return `$${Math.round(value).toLocaleString('es-AR')}`;
}
