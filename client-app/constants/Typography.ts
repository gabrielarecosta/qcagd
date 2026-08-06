// Tipografía — Tamaños grandes para accesibilidad (+40 años)
// Basado en las guías de accesibilidad de Apple y Google

export const FontSize = {
  xs: 13,    // Labels muy pequeños
  sm: 15,    // Texto auxiliar
  md: 17,    // Texto base del sistema iOS
  lg: 19,    // Texto cuerpo principal
  xl: 22,    // Subtítulos
  xxl: 26,   // Títulos de sección
  xxxl: 32,  // Títulos de pantalla
  display: 40, // Números grandes (ej: total)
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const LineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
};
