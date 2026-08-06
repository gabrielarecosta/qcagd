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

      loginAsCliente: async (username, password) => {
        const u = username.trim().toLowerCase();
        
        // Buscar en la tabla de clientes de Supabase
        let query = supabase.from('customers').select('*').eq('activo', true).is('deleted_at', null);
        
        // Si contiene '@', buscar por email; si es número puro, por cuit/telefono; si no, por nombre
        if (u.includes('@')) {
          query = query.eq('email', u);
        } else if (/^\d+$/.test(u.replace(/[-+]/g, ''))) {
          query = query.or(`cuit.eq.${u},telefono.eq.${u}`);
        } else {
          query = query.ilike('nombre', `%${u}%`);
        }

        const { data: customers } = await query;
        let client = customers && customers.length > 0 ? customers[0] : null;

        // Fallback para demo con "ana"
        if (!client && (u === 'ana' || u.includes('ana'))) {
          const { data: ana } = await supabase
            .from('customers')
            .select('*')
            .eq('email', 'ana@gmail.com')
            .maybeSingle();
          client = ana;
        }

        if (client) {
          set({
            isLoggedIn: true,
            userRole: 'cliente',
            lastUsername: username,
            sessionExpired: false,
            clientData: {
              id: client.id,
              nombre: client.nombre,
              razonSocial: client.razon_social || client.nombre,
              cuit: client.cuit || '',
              telefono: client.telefono || '',
              whatsapp: client.whatsapp || '',
              email: client.email || '',
              direccion: client.direccion || '',
              zona: client.zona || '',
              branchId: client.branch_id || 'branch-gd1',
              tipoCliente: client.tipo_cliente || 'minorista',
              activo: client.activo,
              observaciones: client.observaciones || undefined,
              fechaAlta: client.fecha_alta,
            },
            repartidorData: null,
          });
          return true;
        }
        return false;
      },

      loginAsRepartidor: async (username, password) => {
        const u = username.trim().toLowerCase();

        // Buscar en profiles donde rol = 'repartidor'
        let query = supabase.from('profiles').select('*').eq('rol', 'repartidor');
        if (u.includes('@')) {
          query = query.eq('email', u);
        } else {
          query = query.ilike('nombre', `%${u}%`);
        }

        const { data: profiles } = await query;
        let driver = profiles && profiles.length > 0 ? profiles[0] : null;

        // Fallback para demo con "daniel"
        if (!driver && (u === 'daniel' || u.includes('daniel'))) {
          const { data: daniel } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', 'daniel@quimicadeheza.com')
            .maybeSingle();
          driver = daniel;
        }

        if (driver) {
          // Validar contraseña si está configurada en Supabase
          const storedPassword = driver.password || '';
          if (storedPassword.trim() !== '') {
            if (storedPassword !== password) {
              return false;
            }
          }

          set({
            isLoggedIn: true,
            userRole: 'repartidor',
            lastUsername: username,
            sessionExpired: false,
            clientData: null,
            repartidorData: {
              id: driver.id,
              nombre: driver.nombre,
              email: driver.email,
              telefono: driver.telefono || '',
              rol: 'repartidor',
              branchId: driver.branch_id || 'branch-gd1',
              activo: driver.activo,
              auto: driver.auto || '',
              patente: driver.patente || '',
              fotoUrl: driver.foto_url || '',
              dni: driver.dni || '',
            },
          });
          return true;
        }
        
        return false;
      },

      logout: () => {
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
