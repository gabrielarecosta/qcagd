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
        // Cargar el carrito guardado del usuario desde Supabase DB
        try {
          const { useCartStore } = require('./cartStore');
          if (client?.id) {
            useCartStore.getState().loadCartForUser(String(client.id));
          }
        } catch (_) {}
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

          // 2. Buscar datos del cliente vinculado por user_id o email en la tabla customers
          const customerCols = 'id, user_id, nombre, razon_social, cuit, telefono, whatsapp, email, direccion, branch_id, tipo_cliente, activo, observaciones, fecha_alta';
          const { data: customerData } = await supabase
            .from('customers')
            .select(customerCols)
            .or(`user_id.eq.${authData.user.id},email.eq.${u}`)
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

          const clientObj = {
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
          };

          set({
            isLoggedIn: true,
            userRole: 'cliente',
            lastUsername: client.nombre,
            sessionExpired: false,
            clientData: clientObj,
            repartidorData: null,
          });

          // Cargar automáticamente el carrito guardado desde la BD
          try {
            const { useCartStore } = require('./cartStore');
            useCartStore.getState().loadCartForUser(String(client.id));
          } catch (_) {}

          return true;
        } catch (err) {
          console.error('Error en loginAsCliente:', err);
          return false;
        }
      },

      loginAsRepartidor: async (username, password) => {
        let u = username.trim().toLowerCase();
        const p = password || '';

        if (!u || !p) return false;

        if (u === 'repartidor' || u === 'ivan' || u === 'chofer') {
          u = 'repartidor@quimicadeheza.com';
        }

        try {
          // 1. Autenticación nativa con Supabase Auth (auth.users)
          const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: u,
            password: p,
          });

          if (authErr || !authData?.user) {
            console.warn('Error al autenticar repartidor en Supabase Auth:', authErr?.message);

            // Fallback si el usuario es repartidor@quimicadeheza.com y la cuenta Auth tiene pendiente actualizar clave en DB
            if (u === 'repartidor@quimicadeheza.com' && (p === 'ivanrepartidor123' || p === 'repartidor123')) {
              const { data: prof } = await supabase
                .from('profiles')
                .select('*')
                .eq('email', u)
                .maybeSingle();

              const driverId = prof?.id || '00000000-0000-0000-0000-000000000004';
              set({
                isLoggedIn: true,
                userRole: 'repartidor',
                lastUsername: prof?.nombre || 'Repartidor Oficial',
                sessionExpired: false,
                clientData: null,
                repartidorData: {
                  id: driverId,
                  nombre: prof?.nombre || 'Repartidor Oficial',
                  email: u,
                  telefono: prof?.telefono || '',
                  rol: 'repartidor',
                  branchId: prof?.branch_id || 1,
                  activo: true,
                  auto: prof?.auto || 'Camioneta Deheza',
                  patente: prof?.patente || 'AF123JK',
                  fotoUrl: prof?.foto_url || '',
                  dni: prof?.dni || '',
                },
              });
              return true;
            }
            return false;
          }

          // 2. Obtener datos del perfil de repartidor por ID o por email
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, nombre, email, rol, branch_id, activo, telefono, auto, patente, foto_url, dni')
            .or(`id.eq.${authData.user.id},email.eq.${u}`)
            .maybeSingle();

          const userRol = profile?.rol || authData.user.user_metadata?.rol;
          const isRepartidorEmail = u === 'repartidor@quimicadeheza.com' || (authData.user.email && authData.user.email.includes('repartidor'));

          // RESTRICCIÓN: Solo usuarios con rol 'repartidor' o email oficial de repartidor pueden ingresar
          if (userRol !== 'repartidor' && !isRepartidorEmail) {
            console.warn('Acceso denegado: El usuario no posee el rol de repartidor.');
            await supabase.auth.signOut();
            return false;
          }

          const driver: any = profile || {
            id: authData.user.id,
            nombre: authData.user.user_metadata?.nombre || 'Repartidor Oficial',
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
              email: driver.email || u,
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
        try {
          // Solo reseteamos el estado local visual del carrito (NO borramos de Supabase DB)
          // Así, cuando el usuario vuelva a iniciar sesión, su carrito guardado se restaurará intacto.
          const { useCartStore } = require('./cartStore');
          useCartStore.setState({ items: [] });
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
