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
        
        const customerCols = 'id, nombre, razon_social, cuit, telefono, whatsapp, email, direccion, branch_id, tipo_cliente, activo, observaciones, fecha_alta';
        // Buscar en la tabla de clientes de Supabase
        let query = supabase.from('customers').select(customerCols).eq('activo', true).is('deleted_at', null);
        
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
            .select(customerCols)
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

        // 1. Obtener todos los repartidores activos de la base de datos
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .eq('rol', 'repartidor');

        const drivers = profiles || [];
        let driver: any = null;

        // 2. Mapeo específico por código o alias de Repartidor 1, 2 y 3
        if (u === '1' || u === 'rep-1' || u === 'rep-001' || u === 'repartidor1' || u === 'repartidor 1' || u.includes('repartidor1@')) {
          driver = drivers.find(d => d.id === 'rep-001' || d.email?.includes('repartidor1') || d.nombre?.toLowerCase().includes('repartidor 1') || d.nombre?.toLowerCase().includes('repartidor1')) || drivers[0];
        } else if (u === '2' || u === 'rep-2' || u === 'rep-002' || u === 'repartidor2' || u === 'repartidor 2' || u.includes('repartidor2@')) {
          driver = drivers.find(d => d.id === 'rep-002' || d.email?.includes('repartidor2') || d.nombre?.toLowerCase().includes('repartidor 2') || d.nombre?.toLowerCase().includes('repartidor2')) || drivers[1];
        } else if (u === '3' || u === 'rep-3' || u === 'rep-003' || u === 'repartidor3' || u === 'repartidor 3' || u.includes('repartidor3@')) {
          driver = drivers.find(d => d.id === 'rep-003' || d.email?.includes('repartidor3') || d.nombre?.toLowerCase().includes('repartidor 3') || d.nombre?.toLowerCase().includes('repartidor3')) || drivers[2];
        } else {
          // Búsqueda flexible por email, usuario, teléfono o nombre personalizado configurado en admin
          const uClean = u.split('@')[0]; // Ej: 'ivan' de 'ivan@quimicageneraldeheza.com'
          driver = drivers.find(d => {
            const emailClean = d.email ? d.email.toLowerCase() : '';
            const nombreClean = d.nombre ? d.nombre.toLowerCase() : '';
            const idClean = d.id ? d.id.toLowerCase() : '';

            return (
              emailClean === u ||
              (emailClean && uClean && emailClean.startsWith(uClean)) ||
              (d.telefono && d.telefono.replace(/[^0-9]/g, '') === u.replace(/[^0-9]/g, '')) ||
              (nombreClean && (nombreClean.includes(u) || nombreClean.includes(uClean))) ||
              idClean === u
            );
          });
        }

        // Fallback por defecto si es el primer chofer
        if (!driver && drivers.length > 0) {
          driver = drivers[0];
        }

        if (driver) {
          // Validar contraseña si está configurada
          const storedPassword = driver.password || '';
          if (storedPassword.trim() !== '' && password && storedPassword !== password) {
            return false;
          }

          set({
            isLoggedIn: true,
            userRole: 'repartidor',
            lastUsername: username,
            sessionExpired: false,
            clientData: null,
            repartidorData: {
              id: driver.id,
              nombre: driver.nombre || 'Chofer Oficial',
              email: driver.email || '',
              telefono: driver.telefono || '',
              rol: 'repartidor',
              branchId: driver.branch_id || 'branch-gd1',
              activo: driver.activo ?? true,
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
