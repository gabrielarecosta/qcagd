import { supabase } from './supabaseClient';

export interface Localidad {
  id: string;
  nombre: string;
  provincia: string;
  codigoPostal?: string;
  branchId?: number;
  activa: boolean;
  repartoHabilitado: boolean;
}

export const localidadService = {
  getAll: async (): Promise<Localidad[]> => {
    try {
      const { data, error } = await supabase
        .from('localidades')
        .select('*')
        .order('nombre', { ascending: true });
      
      if (error) {
        console.warn('Error al obtener localidades de Supabase:', error.message);
        return localidadService.getDefaults();
      }
      if (!data || data.length === 0) {
        return localidadService.getDefaults();
      }
      return data.map((d: any) => ({
        id: String(d.id),
        nombre: d.nombre,
        provincia: d.provincia || 'Córdoba',
        codigoPostal: d.codigo_postal || '',
        branchId: d.branch_id ? Number(d.branch_id) : undefined,
        activa: d.activa !== false,
        repartoHabilitado: d.reparto_habilitado !== false,
      }));
    } catch (e) {
      console.warn('Error en localidadService.getAll:', e);
      return localidadService.getDefaults();
    }
  },

  getActiveAllowed: async (): Promise<Localidad[]> => {
    const list = await localidadService.getAll();
    return list.filter(l => l.activa && l.repartoHabilitado);
  },

  create: async (loc: Omit<Localidad, 'id'>): Promise<Localidad> => {
    const dbPayload = {
      nombre: loc.nombre.trim(),
      provincia: loc.provincia || 'Córdoba',
      codigo_postal: loc.codigoPostal || null,
      branch_id: loc.branchId || null,
      activa: loc.activa ?? true,
      reparto_habilitado: loc.repartoHabilitado ?? true,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('localidades')
      .upsert(dbPayload, { onConflict: 'nombre,provincia' })
      .select('*')
      .single();

    if (error) throw error;
    return {
      id: String(data.id),
      nombre: data.nombre,
      provincia: data.provincia,
      codigoPostal: data.codigo_postal || '',
      branchId: data.branch_id ? Number(data.branch_id) : undefined,
      activa: data.activa,
      repartoHabilitado: data.repartoHabilitado,
    };
  },

  update: async (id: string, updates: Partial<Localidad>): Promise<void> => {
    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.nombre !== undefined) dbUpdates.nombre = updates.nombre;
    if (updates.activa !== undefined) dbUpdates.activa = updates.activa;
    if (updates.repartoHabilitado !== undefined) dbUpdates.reparto_habilitado = updates.repartoHabilitado;
    if (updates.codigoPostal !== undefined) dbUpdates.codigo_postal = updates.codigoPostal;
    if (updates.provincia !== undefined) dbUpdates.provincia = updates.provincia;

    const { error } = await supabase.from('localidades').update(dbUpdates).eq('id', id);
    if (error) console.warn('No se pudo actualizar localidad en BD:', error.message);
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('localidades').delete().eq('id', id);
    if (error) console.warn('Error al eliminar localidad:', error.message);
  },

  getDefaults: (): Localidad[] => [
    { id: '1', nombre: 'General Deheza', provincia: 'Córdoba', codigoPostal: '5923', activa: true, repartoHabilitado: true },
    { id: '2', nombre: 'General Cabrera', provincia: 'Córdoba', codigoPostal: '5921', activa: true, repartoHabilitado: true },
    { id: '3', nombre: 'Las Perdices', provincia: 'Córdoba', codigoPostal: '5925', activa: true, repartoHabilitado: true },
    { id: '4', nombre: 'Río Cuarto', provincia: 'Córdoba', codigoPostal: '5800', activa: true, repartoHabilitado: true },
    { id: '5', nombre: 'Villa María', provincia: 'Córdoba', codigoPostal: '5900', activa: true, repartoHabilitado: true },
  ]
};
