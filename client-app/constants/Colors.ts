// Paleta de colores principal
// Diseñada para alto contraste y fácil legibilidad (usuarios +40 años)

export const Colors = {
  // Colores primarios
  primary: '#1A56DB',      // Azul principal
  primaryDark: '#1244AF',  // Azul oscuro (pressed)
  primaryLight: '#EBF0FF', // Azul muy claro (backgrounds)

  // Colores de acción
  success: '#16A34A',      // Verde éxito / agregar
  successDark: '#0F7535',
  successLight: '#DCFCE7',

  warning: '#D97706',      // Amarillo alerta
  warningLight: '#FEF3C7',

  danger: '#DC2626',       // Rojo error / eliminar
  dangerLight: '#FEE2E2',

  // Neutros
  white: '#FFFFFF',
  background: '#F8FAFC',   // Fondo principal (gris muy claro)
  surface: '#FFFFFF',      // Cards y superficies
  surfaceAlt: '#F1F5F9',   // Fondo alternativo

  // Texto
  textPrimary: '#0F172A',  // Texto principal (casi negro)
  textSecondary: '#475569', // Texto secundario
  textDisabled: '#94A3B8', // Texto deshabilitado
  textInverse: '#FFFFFF',  // Texto sobre fondos oscuros

  // Bordes
  border: '#E2E8F0',
  borderFocus: '#1A56DB',

  // Estados de pedido
  statusPending: '#D97706',
  statusPreparing: '#2563EB',
  statusOnTheWay: '#7C3AED',
  statusDelivered: '#16A34A',
  statusCancelled: '#DC2626',

  // Tab bar
  tabActive: '#1A56DB',
  tabInactive: '#94A3B8',
  tabBackground: '#FFFFFF',
};

export type ColorKey = keyof typeof Colors;
