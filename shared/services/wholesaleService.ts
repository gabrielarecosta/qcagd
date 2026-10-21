import { supabase } from './supabaseClient';

export interface WholesaleApplication {
  id: number;
  customer_id?: number | null;
  nombre: string;
  dni?: string | null;
  razon_social: string;
  cuit: string;
  rubro: string;
  telefono: string;
  email: string;
  direccion: string;
  localidad: string;
  provincia?: string;
  volumen_estimado?: string;
  notas?: string | null;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  revisado_por?: string | null;
  fecha_solicitud: string;
  fecha_resolucion?: string | null;
  motivo_rechazo?: string | null;
  created_at?: string;
  updated_at?: string;
  // Campos derivados para UI
  source?: 'table' | 'customer';
}

export const wholesaleService = {
  /**
   * Obtiene todas las solicitudes mayoristas registradas.
   * Cruza la tabla wholesale_applications con clientes que se hayan postulado
   * para garantizar que ningún postulante quede afuera.
   */
  getAll: async (): Promise<WholesaleApplication[]> => {
    const list: WholesaleApplication[] = [];
    const registeredCustomerIds = new Set<number>();
    const registeredEmails = new Set<string>();

    // 1. Obtener desde tabla wholesale_applications
    try {
      const { data, error } = await supabase
        .from('wholesale_applications')
        .select('*')
        .order('fecha_solicitud', { ascending: false });

      if (!error && Array.isArray(data)) {
        data.forEach((app: any) => {
          list.push({
            id: Number(app.id),
            customer_id: app.customer_id ? Number(app.customer_id) : null,
            nombre: app.nombre || '',
            dni: app.dni || null,
            razon_social: app.razon_social || app.nombre || '',
            cuit: app.cuit || '',
            rubro: app.rubro || 'General',
            telefono: app.telefono || '',
            email: app.email || '',
            direccion: app.direccion || '',
            localidad: app.localidad || 'General Deheza',
            provincia: app.provincia || 'Córdoba',
            volumen_estimado: app.volumen_estimado || '',
            notas: app.notas || null,
            estado: (app.estado as any) || 'pendiente',
            revisado_por: app.revisado_por || null,
            fecha_solicitud: app.fecha_solicitud || app.created_at || new Date().toISOString(),
            fecha_resolucion: app.fecha_resolucion || null,
            motivo_rechazo: app.motivo_rechazo || null,
            created_at: app.created_at,
            updated_at: app.updated_at,
            source: 'table',
          });

          if (app.customer_id) registeredCustomerIds.add(Number(app.customer_id));
          if (app.email) registeredEmails.add(String(app.email).toLowerCase().trim());
        });
      }
    } catch (err) {
      console.warn('Tabla wholesale_applications no disponible o vacía:', err);
    }

    // 2. Traer postulantes registrados en la tabla customers que no figuren arriba
    try {
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .eq('tipo_cliente', 'mayorista')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (!custErr && Array.isArray(custData)) {
        custData.forEach((c: any) => {
          const cId = Number(c.id);
          const cEmail = (c.email || c.auth_email || '').toLowerCase().trim();

          // Si ya está registrado en wholesale_applications, sincronizar el estado
          const existing = list.find(item => item.customer_id === cId || (cEmail && item.email.toLowerCase().trim() === cEmail));
          if (existing) {
            // Si en customer ya está autorizado y en la solicitud figuraba pendiente, reflejar estado
            if (c.mayorista_autorizado && existing.estado === 'pendiente') {
              existing.estado = 'aprobada';
            }
            return;
          }

          // Si no estaba en wholesale_applications, lo sumamos como postulación
          // Extraer rubro y volumen de observaciones si vinieron formateados
          let rubro = c.rubro || 'Comercio / Reventa';
          let volumen = c.volumen_estimado || '';
          let notas = c.observaciones || '';

          if (notas.includes('[SOLICITUD ADMISIÓN MAYORISTA]')) {
            const rubroMatch = notas.match(/Rubro:\s*([^|]+)/i);
            const volMatch = notas.match(/Vol\.\s*Estimado:\s*([^|]+)/i);
            const notasMatch = notas.match(/Notas:\s*(.+)$/i);
            if (rubroMatch) rubro = rubroMatch[1].trim();
            if (volMatch) volumen = volMatch[1].trim();
            if (notasMatch) notas = notasMatch[1].trim();
          }

          const estado: 'pendiente' | 'aprobada' | 'rechazada' = 
            c.mayorista_autorizado ? 'aprobada' : (c.estado_solicitud_mayorista === 'rechazada' ? 'rechazada' : 'pendiente');

          list.push({
            id: -(cId), // ID negativo para diferenciarlo si es virtual
            customer_id: cId,
            nombre: c.nombre || '',
            dni: null,
            razon_social: c.razon_social || c.nombre || '',
            cuit: c.cuit || 'S/D',
            rubro,
            telefono: c.whatsapp || c.telefono || '',
            email: c.email || c.auth_email || '',
            direccion: c.direccion || '',
            localidad: c.localidad || 'General Deheza',
            provincia: 'Córdoba',
            volumen_estimado: volumen,
            notas: notas || null,
            estado,
            revisado_por: null,
            fecha_solicitud: c.fecha_solicitud_mayorista || c.fecha_alta || c.created_at || new Date().toISOString(),
            fecha_resolucion: c.fecha_resolucion_mayorista || null,
            motivo_rechazo: c.motivo_rechazo_mayorista || null,
            source: 'customer',
          });
        });
      }
    } catch (custCatch) {
      console.warn('Error al complementar postulaciones desde customers:', custCatch);
    }

    // Ordenar de más reciente a más antigua
    return list.sort((a, b) => new Date(b.fecha_solicitud).getTime() - new Date(a.fecha_solicitud).getTime());
  },

  /**
   * Aprueba una solicitud mayorista y habilita al cliente en el sistema.
   */
  approve: async (application: WholesaleApplication, adminEmail?: string): Promise<{ success: boolean; message: string }> => {
    const now = new Date().toISOString();

    // 1. Intentar RPC oficial si el customer_id está disponible
    if (application.customer_id) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('approve_wholesale_application', {
          p_customer_id: application.customer_id,
          p_admin_email: adminEmail || 'admin@quimicadeheza.com',
        });
        if (!rpcErr && rpcRes && rpcRes.success) {
          return { success: true, message: 'Solicitud aprobada y cliente autorizado como mayorista.' };
        }
      } catch {
        // Continuar con actualización directa
      }
    }

    // 2. Actualización directa de customers
    if (application.customer_id) {
      await supabase
        .from('customers')
        .update({
          tipo_cliente: 'mayorista',
          mayorista_autorizado: true,
          estado_solicitud_mayorista: 'aprobada',
          fecha_resolucion_mayorista: now,
          updated_at: now,
        })
        .eq('id', application.customer_id);
    } else if (application.email) {
      await supabase
        .from('customers')
        .update({
          tipo_cliente: 'mayorista',
          mayorista_autorizado: true,
          estado_solicitud_mayorista: 'aprobada',
          fecha_resolucion_mayorista: now,
          updated_at: now,
        })
        .ilike('email', application.email.trim());
    }

    // 3. Actualización de tabla wholesale_applications si el ID es positivo
    if (application.id > 0) {
      await supabase
        .from('wholesale_applications')
        .update({
          estado: 'aprobada',
          fecha_resolucion: now,
          revisado_por: adminEmail || 'Administrador',
          updated_at: now,
        })
        .eq('id', application.id);
    }

    return { success: true, message: 'Solicitud aprobada y cliente autorizado como mayorista exitosamente.' };
  },

  /**
   * Rechaza una solicitud mayorista y marca al cliente como minorista.
   */
  reject: async (application: WholesaleApplication, motivo: string, adminEmail?: string): Promise<{ success: boolean; message: string }> => {
    const now = new Date().toISOString();
    const motivoText = motivo.trim() || 'No cumple requisitos mínimos de compra por volumen.';

    // 1. Intentar RPC oficial si el customer_id está disponible
    if (application.customer_id) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('reject_wholesale_application', {
          p_customer_id: application.customer_id,
          p_motivo: motivoText,
          p_admin_email: adminEmail || 'admin@quimicadeheza.com',
        });
        if (!rpcErr && rpcRes && rpcRes.success) {
          return { success: true, message: 'Solicitud rechazada correctamente.' };
        }
      } catch {
        // Continuar con actualización directa
      }
    }

    // 2. Actualización directa de customers
    if (application.customer_id) {
      await supabase
        .from('customers')
        .update({
          tipo_cliente: 'minorista',
          mayorista_autorizado: false,
          estado_solicitud_mayorista: 'rechazada',
          motivo_rechazo_mayorista: motivoText,
          fecha_resolucion_mayorista: now,
          updated_at: now,
        })
        .eq('id', application.customer_id);
    }

    // 3. Actualización de wholesale_applications
    if (application.id > 0) {
      await supabase
        .from('wholesale_applications')
        .update({
          estado: 'rechazada',
          motivo_rechazo: motivoText,
          fecha_resolucion: now,
          revisado_por: adminEmail || 'Administrador',
          updated_at: now,
        })
        .eq('id', application.id);
    }

    return { success: true, message: 'Solicitud rechazada.' };
  },

  /**
   * Conteo rápido de solicitudes pendientes para badges en sidebar y dashboard
   */
  getPendingCount: async (): Promise<number> => {
    try {
      const all = await wholesaleService.getAll();
      return all.filter(a => a.estado === 'pendiente').length;
    } catch {
      return 0;
    }
  },
};
