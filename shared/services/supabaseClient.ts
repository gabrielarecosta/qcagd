import { createClient } from '@supabase/supabase-js';

let supabaseUrl = '';
let supabaseKey = '';

// 1. Admin panel: Vite
try {
  const viteEnv = (import.meta as any).env;

  if (viteEnv) {
    supabaseUrl = viteEnv.VITE_SUPABASE_URL || '';
    supabaseKey = viteEnv.VITE_SUPABASE_ANON_KEY || '';
  }
} catch {
  // No estamos ejecutando dentro de Vite
}

// 2. Client app: Expo
// Expo exige referencias directas process.env.EXPO_PUBLIC_...
// para insertar los valores durante el build.
if (!supabaseUrl && typeof process !== 'undefined') {
  // @ts-ignore Expo reemplaza esta variable durante el build
  supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
}

if (!supabaseKey && typeof process !== 'undefined') {
  // @ts-ignore Expo reemplaza esta variable durante el build
  supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
}

// 3. Backend: Node.js / Cloudflare Worker con nodejs_compat
if (!supabaseUrl && typeof process !== 'undefined') {
  // @ts-ignore Variable disponible solamente en el backend
  supabaseUrl = process.env.SUPABASE_URL || '';
}

if (!supabaseKey && typeof process !== 'undefined') {
  // @ts-ignore Variables disponibles solamente en el backend
  supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
}

// No usar valores placeholder: si falta algo, mostramos el error real.
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Faltan las variables de Supabase para este entorno. ' +
      'Admin: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. ' +
      'Cliente: EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Backend: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

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