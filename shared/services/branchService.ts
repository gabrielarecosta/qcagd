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

  getById: async (id: string): Promise<Branch | undefined> => {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapBranch(data) : undefined;
  },

  update: async (id: string, updates: Partial<Branch>): Promise<Branch> => {
    const dbUpdates: any = {
      nombre: updates.nombre,
      direccion: updates.direccion,
      telefono: updates.telefono,
      whatsapp: updates.whatsapp,
      horario_atencion: updates.horarioAtencion,
      activo: updates.activo,
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

  create: async (branch: Omit<Branch, 'id'>): Promise<Branch> => {
    const branchId = `branch-${Date.now()}`;
    const dbInsert = {
      id: branchId,
      nombre: branch.nombre,
      direccion: branch.direccion,
      telefono: branch.telefono,
      whatsapp: branch.whatsapp,
      horario_atencion: branch.horarioAtencion,
      activo: branch.activo ?? true,
    };

    const { data, error } = await supabase
      .from('branches')
      .insert(dbInsert)
      .select('*')
      .single();

    if (error) throw error;
    return mapBranch(data);
  }
};
