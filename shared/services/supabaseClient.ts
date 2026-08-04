import { createClient } from '@supabase/supabase-js';

// Detect environment variables dynamically
let supabaseUrl = '';
let supabaseAnonKey = '';

// Check if running in a Vite environment
try {
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    // @ts-ignore
    supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  }
} catch (e) {
  // Silent catch for environments where import.meta is not defined
}

// Fallback to process.env (Node / Expo / React Native)
// Se accede indirectamente para evitar que el compilador Babel de Expo intente inyectar módulos virtuales fuera del root del proyecto
const globalProc = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
if (!supabaseUrl && globalProc) {
  const env = globalProc.env || {};
  supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';
}


// Default fallbacks for testing/initial dev to prevent application crashes
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase credentials missing. Please set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (Vite) ' +
    'or EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (Expo) in your .env files.'
  );
  supabaseUrl = 'https://placeholder-project.supabase.co';
  supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIn0.signature';
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Helper to set session context variables in PostgreSQL for auditing.
 * Since we run on client side directly, we can call a RPC function or run a query
 * to set user session context before performing updates/inserts if needed.
 */
export async function setDbUserContext(email: string, actionType = 'manual', criteria = 'User edit') {
  try {
    // We execute these settings using a RPC or direct query if permissions allow.
    // In many Supabase setups, client-side raw SQL EXECUTE is disabled,
    // so we can fallback to using standard triggers that default to client profile roles.
    // Here we store it for use in services.
    (supabase as any).currentUserEmail = email;
    (supabase as any).priceChangeType = actionType;
    (supabase as any).priceChangeCriteria = criteria;
  } catch (error) {
    console.error('Failed to set DB user context', error);
  }
}
