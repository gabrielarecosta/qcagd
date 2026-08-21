import { supabase } from './supabaseClient';
import { Branch } from '../types/branch';

const mapBranch = (d: any): Branch => ({
  id: d.id,
  nombre: d.nombre,
  direccion: d.direccion || '',
  telefono: d.telefono || '',
  whatsapp: d.whatsapp || '',
  horarioAtencion: d.horario_atencion || '',
  activo: d.activo,
  latitude: d.latitude ? Number(d.latitude) : undefined,
  longitude: d.longitude ? Number(d.longitude) : undefined,
});

export const branchService = {
  getAll: async (): Promise<Branch[]> => {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('nombre', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapBranch);
  },

  getById: async (id: string | number): Promise<Branch | undefined> => {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapBranch(data) : undefined;
  },

  update: async (id: string | number, updates: Partial<Branch>): Promise<Branch> => {
    const dbUpdates: any = {
      nombre: updates.nombre,
      direccion: updates.direccion,
      telefono: updates.telefono,
      whatsapp: updates.whatsapp,
      horario_atencion: updates.horarioAtencion,
      activo: updates.activo,
      latitude: updates.latitude,
      longitude: updates.longitude,
    };

    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const { data, error } = await supabase
      .from('branches')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return mapBranch(data);
  },

  create: async (branch: Omit<Branch, 'id'> & { id?: string | number }): Promise<Branch> => {
    const dbInsert: any = {
      nombre: branch.nombre,
      direccion: branch.direccion,
      telefono: branch.telefono,
      whatsapp: branch.whatsapp,
      horario_atencion: branch.horarioAtencion,
      activo: branch.activo ?? true,
    };

    if (branch.id) {
      dbInsert.id = branch.id;
    }

    const { data, error } = await supabase
      .from('branches')
      .insert(dbInsert)
      .select('*')
      .single();

    if (error) throw error;
    return mapBranch(data);
  }
};
