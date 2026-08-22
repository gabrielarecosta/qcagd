import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Customer } from '@shared/types/client';
import { InternalUser } from '@shared/types/user';
import { supabase } from '@shared/services/supabaseClient';

interface AuthState {
  isLoggedIn: boolean;
  userRole: 'cliente' | 'repartidor' | null;
  clientData: Customer | null;
  repartidorData: InternalUser | null;
  
  lastUsername?: string;
  sessionExpired?: boolean;
  setSessionExpired: (expired: boolean) => void;
  setClienteSession: (client: Customer) => void;
  
  loginAsCliente: (username: string, password?: string) => Promise<boolean>;
  loginAsRepartidor: (username: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

// Wrapper seguro para evitar crashes si localStorage no existe (entorno nativo sin AsyncStorage)
const safeStorage = {
  getItem: (name: string): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(name);
    }
    return null;
  },
  setItem: (name: string, value: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(name, value);
    }
  },
  removeItem: (name: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(name);
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      userRole: null,
      clientData: null,
      repartidorData: null,
      lastUsername: '',
      sessionExpired: false,
      setSessionExpired: (expired) => set({ sessionExpired: expired }),

      setClienteSession: (client) => {
        set({
          isLoggedIn: true,
          userRole: 'cliente',
          lastUsername: client.nombre,
          sessionExpired: false,
          clientData: client,
          repartidorData: null,
        });
      },

      loginAsCliente: async (username, password) => {
        const u = username.trim().toLowerCase();
        const p = password || '';

        if (!u || !p) return false;

        try {
          // 1. Autenticación nativa con Supabase Auth (auth.users)
          const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: u,
            password: p,
          });

          if (authErr || !authData.user) {
            console.warn('Error al autenticar en Supabase Auth:', authErr?.message);
            return false;
          }

          // 2. Buscar datos del cliente vinculado en la tabla customers
          const customerCols = 'id, nombre, razon_social, cuit, telefono, whatsapp, email, direccion, branch_id, tipo_cliente, activo, observaciones, fecha_alta';
          const { data: customerData } = await supabase
            .from('customers')
            .select(customerCols)
            .or(`id.eq.${authData.user.id},email.eq.${u}`)
            .maybeSingle();

          const client: any = customerData || {
            id: authData.user.id,
            nombre: authData.user.user_metadata?.nombre || u.split('@')[0],
            razon_social: authData.user.user_metadata?.razon_social || '',
            cuit: '',
            telefono: authData.user.user_metadata?.telefono || '',
            whatsapp: authData.user.user_metadata?.telefono || '',
            email: authData.user.email || u,
            direccion: '',
            branch_id: 1,
            tipo_cliente: 'minorista',
            activo: true,
            observaciones: undefined,
            fecha_alta: new Date().toISOString(),
          };

          set({
            isLoggedIn: true,
            userRole: 'cliente',
            lastUsername: client.nombre,
            sessionExpired: false,
            clientData: {
              id: client.id,
              nombre: client.nombre,
              razonSocial: client.razon_social || client.nombre,
              cuit: client.cuit || '',
              telefono: client.telefono || '',
              whatsapp: client.whatsapp || '',
              email: client.email || u,
              direccion: client.direccion || '',
              branchId: client.branch_id || 1,
              tipoCliente: client.tipo_cliente || 'minorista',
              activo: client.activo ?? true,
              observaciones: client.observaciones || undefined,
              fechaAlta: client.fecha_alta,
            },
            repartidorData: null,
          });
          return true;
        } catch (err) {
          console.error('Error en loginAsCliente:', err);
          return false;
        }
      },

      loginAsRepartidor: async (username, password) => {
        const u = username.trim().toLowerCase();
        const p = password || '';

        if (!u || !p) return false;

        try {
          // 1. Autenticación nativa con Supabase Auth (auth.users)
          const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: u,
            password: p,
          });

          if (authErr || !authData.user) {
            console.warn('Error al autenticar repartidor en Supabase Auth:', authErr?.message);
            return false;
          }

          // 2. Obtener datos del perfil de repartidor
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, nombre, email, rol, branch_id, activo, telefono, auto, patente, foto_url, dni')
            .eq('id', authData.user.id)
            .maybeSingle();

          const driver: any = profile || {
            id: authData.user.id,
            nombre: authData.user.user_metadata?.nombre || 'Chofer Oficial',
            email: authData.user.email || u,
            rol: 'repartidor',
            branch_id: 1,
            activo: true,
            telefono: '',
            auto: '',
            patente: '',
            foto_url: '',
            dni: '',
          };

          set({
            isLoggedIn: true,
            userRole: 'repartidor',
            lastUsername: driver.nombre,
            sessionExpired: false,
            clientData: null,
            repartidorData: {
              id: driver.id,
              nombre: driver.nombre,
              email: driver.email || '',
              telefono: driver.telefono || '',
              rol: 'repartidor',
              branchId: driver.branch_id || 1,
              activo: driver.activo ?? true,
              auto: driver.auto || '',
              patente: driver.patente || '',
              fotoUrl: driver.foto_url || '',
              dni: driver.dni || '',
            },
          });
          return true;
        } catch (err) {
          console.error('Error en loginAsRepartidor:', err);
          return false;
        }
      },

      logout: () => {
        try {
          supabase.auth.signOut();
        } catch (_) {}
        set({
          isLoggedIn: false,
          userRole: null,
          clientData: null,
          repartidorData: null,
        });
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
