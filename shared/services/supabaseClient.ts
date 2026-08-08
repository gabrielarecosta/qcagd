import { createClient } from '@supabase/supabase-js';

let supabaseUrl = '';
let supabaseAnonKey = '';

// Variables del admin-panel (Vite)
try {
  const viteEnv = (import.meta as any).env;

  if (viteEnv) {
    supabaseUrl = viteEnv.VITE_SUPABASE_URL || '';
    supabaseAnonKey = viteEnv.VITE_SUPABASE_ANON_KEY || '';
  }
} catch {
  // Expo no utiliza import.meta.env
}

// Variables del client-app (Expo)
if (!supabaseUrl) {
  // @ts-ignore Expo reemplaza esta variable durante el build
  supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
}

if (!supabaseAnonKey) {
  // @ts-ignore Expo reemplaza esta variable durante el build
  supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
}

// Detener la aplicación si faltan variables.
// No usamos credenciales placeholder porque ocultarían el problema.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan las variables de Supabase. ' +
    'Para admin-panel configurá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. ' +
    'Para client-app configurá EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Guarda información del usuario actual para los servicios
 * y procesos de auditoría.
 */
export async function setDbUserContext(
  email: string,
  actionType = 'manual',
  criteria = 'User edit'
) {
  try {
    (supabase as any).currentUserEmail = email;
    (supabase as any).priceChangeType = actionType;
    (supabase as any).priceChangeCriteria = criteria;
  } catch (error) {
    console.error('Failed to set DB user context', error);
  }
}