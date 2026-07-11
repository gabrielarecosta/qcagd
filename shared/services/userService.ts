import { supabase } from './supabaseClient';
import { InternalUser } from '../types/user';

const mapProfile = (d: any): InternalUser => ({
  id: d.id,
  nombre: d.nombre,
  email: d.email,
  rol: d.rol,
  branchId: d.branch_id || undefined,
  sectorId: d.sector_id || undefined,
  activo: d.activo,
  telefono: d.telefono || undefined,
});

export const userService = {
  getAll: async (): Promise<InternalUser[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .is('deleted_at', null);
    if (error) throw error;
    return (data || []).map(mapProfile);
  },

  getById: async (id: string): Promise<InternalUser | undefined> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return undefined; // No rows found
      throw error;
    }
    return data ? mapProfile(data) : undefined;
  },

  getByBranchId: async (branchId: string): Promise<InternalUser[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('branch_id', branchId)
      .is('deleted_at', null);
    if (error) throw error;
    return (data || []).map(mapProfile);
  },

  update: async (id: string, updates: Partial<InternalUser>): Promise<InternalUser> => {
    const dbUpdates: any = {
      nombre: updates.nombre,
      email: updates.email,
      rol: updates.rol,
      branch_id: updates.branchId,
      sector_id: updates.sectorId,
      activo: updates.activo,
      telefono: updates.telefono,
      updated_at: new Date().toISOString(),
    };

    // Filter out undefined keys
    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapProfile(data);
  },

  create: async (user: Omit<InternalUser, 'id'> & { id?: string }): Promise<InternalUser> => {
    const userId = user.id || `user-${Date.now()}`;
    const dbInsert: any = {
      id: userId,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      branch_id: user.branchId,
      sector_id: user.sectorId,
      activo: user.activo ?? true,
      telefono: user.telefono,
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert(dbInsert)
      .select('*')
      .single();
    if (error) throw error;
    return mapProfile(data);
  },

  delete: async (id: string, deletedBy?: string): Promise<boolean> => {
    const { error } = await supabase
      .from('profiles')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy || 'admin',
        activo: false
      })
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  loginSimulated: async (email: string): Promise<{ success: boolean; user?: InternalUser; error?: string }> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .eq('activo', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (data) {
      return { success: true, user: mapProfile(data) };
    }
    return { success: false, error: 'Credenciales inválidas o usuario inactivo' };
  }
};
