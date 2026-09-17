import { supabase } from './supabaseClient';
import { parseBranchId } from '../utils/branchUtils';
import { InternalUser } from '../types/user';

const PROFILE_FIELDS = 'id, nombre, email, rol, branch_id, sector_id, activo, telefono, auto, patente, foto_url, dni, created_at, updated_at';

const mapProfile = (d: any): InternalUser => ({
  id: d.id,
  nombre: d.nombre,
  email: d.email,
  rol: d.rol,
  branchId: d.branch_id || undefined,
  activo: d.activo,
  telefono: d.telefono || undefined,
  auto: d.auto || undefined,
  patente: d.patente || undefined,
  fotoUrl: d.foto_url || undefined,
  dni: d.dni || undefined,
});

export const userService = {
  getAll: async (): Promise<InternalUser[]> => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .is('deleted_at', null);
    if (error) throw error;
    return (data || []).map(mapProfile);
  },

  getById: async (id: string): Promise<InternalUser | undefined> => {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .eq('id', id)
      .is('deleted_at', null)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return undefined; // No rows found
      throw error;
    }
    return data ? mapProfile(data) : undefined;
  },

  getByBranchId: async (branchId: string | number): Promise<InternalUser[]> => {
    const branchIdNum = parseBranchId(branchId) || 1;
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_FIELDS)
      .eq('branch_id', branchIdNum)
      .is('deleted_at', null);
    if (error) throw error;
    return (data || []).map(mapProfile);
  },

  update: async (id: string, updates: Partial<InternalUser>): Promise<InternalUser> => {
    let branchIdNum: number | null = null;
    if (updates.branchId) {
      branchIdNum = typeof updates.branchId === 'number' ? updates.branchId : (isNaN(Number(updates.branchId)) ? 1 : Number(updates.branchId));
    }

    const dbUpdates: any = {
      nombre: updates.nombre,
      email: updates.email,
      rol: updates.rol,
      branch_id: updates.branchId !== undefined ? branchIdNum : undefined,
      activo: updates.activo,
      telefono: updates.telefono,
      auto: updates.auto,
      patente: updates.patente,
      foto_url: updates.fotoUrl,
      dni: updates.dni,
      updated_at: new Date().toISOString(),
    };

    // Filter out undefined keys
    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', id)
      .select(PROFILE_FIELDS)
      .single();
    if (error) throw error;

    // Sincronizar tabla drivers si es un repartidor
    if (data.rol === 'repartidor') {
      const { error: driverErr } = await supabase
        .from('drivers')
        .upsert({
          id: id,
          vehiculo_info: data.auto ? `${data.auto} (Patente: ${data.patente})` : 'Sin vehículo registrado',
          activo: data.activo ?? true
        });
      if (driverErr) {
        console.warn('Error upserting driver into drivers table:', driverErr);
      }
    }

    return mapProfile(data);
  },

  create: async (user: Omit<InternalUser, 'id'> & { id?: string | number }): Promise<InternalUser> => {
    let branchIdNum = 1;
    if (user.branchId) {
      const parsed = parseInt(String(user.branchId), 10);
      if (!isNaN(parsed)) branchIdNum = parsed;
    }

    const dbInsert: any = {
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      branch_id: branchIdNum,
      activo: user.activo ?? true,
      telefono: user.telefono || null,
      auto: user.auto || '',
      patente: user.patente || '',
      foto_url: user.fotoUrl || '',
      dni: user.dni || '',
    };

    if (user.id && !isNaN(Number(user.id))) {
      dbInsert.id = Number(user.id);
    }

    const { data, error } = await supabase
      .from('profiles')
      .insert(dbInsert)
      .select(PROFILE_FIELDS)
      .single();
    if (error) throw error;

    // Sincronizar tabla drivers si es un repartidor
    if (data.rol === 'repartidor') {
      const { error: driverErr } = await supabase
        .from('drivers')
        .insert({
          id: data.id,
          vehiculo_info: data.auto ? `${data.auto} (Patente: ${data.patente})` : 'Sin vehículo registrado',
          activo: data.activo ?? true
        });
      if (driverErr) {
        console.warn('Error inserting driver into drivers table:', driverErr);
      }
    }

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
      .select(PROFILE_FIELDS)
      .eq('email', email)
      .eq('activo', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (data) {
      return { success: true, user: mapProfile(data) };
    }
    return { success: false, error: 'Credenciales inválidas o usuario inactivo' };
  },

  resetPassword: async (email: string) => {
    return await supabase.auth.resetPasswordForEmail(email);
  },

  updatePassword: async (newPassword: string) => {
    return await supabase.auth.updateUser({ password: newPassword });
  },

  changeOwnPassword: async (newPassword: string) => {
    if (!newPassword || newPassword.trim().length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      // Fallback a RPC si aplica
      const userRes = await supabase.auth.getUser();
      if (userRes.data?.user?.id) {
        const { error: rpcErr } = await supabase.rpc('update_user_password', {
          target_user_id: userRes.data.user.id,
          new_password: newPassword
        });
        if (rpcErr) throw rpcErr;
        return { user: userRes.data.user };
      }
      throw error;
    }
    return data;
  },

  adminUpdateUserPassword: async (userId: string, newPassword: string) => {
    if (!newPassword || newPassword.trim().length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }
    const { data, error } = await supabase.rpc('update_user_password', {
      target_user_id: userId,
      new_password: newPassword
    });
    if (error) {
      console.warn('Error en RPC update_user_password:', error.message);
      throw error;
    }
    return data;
  },

  adminUpsertUser: async (user: {
    email: string;
    password?: string;
    nombre: string;
    rol?: string;
    branchId?: number | string;
    telefono?: string;
    dni?: string;
    auto?: string;
    patente?: string;
  }) => {
    const { data, error } = await supabase.rpc('admin_upsert_user', {
      p_email: user.email,
      p_password: user.password || null,
      p_nombre: user.nombre,
      p_rol: user.rol || 'ventas',
      p_branch_id: Number(user.branchId || 1),
      p_telefono: user.telefono || null,
      p_dni: user.dni || null,
      p_auto: user.auto || null,
      p_patente: user.patente || null,
    });
    if (error) {
      console.warn('Error en admin_upsert_user RPC:', error.message);
      throw error;
    }
    return data;
  },

  updateOwnProfile: async (userId: string, updates: { email?: string; nombre?: string }) => {
    if (updates.email && updates.email.trim()) {
      const newEmail = updates.email.trim().toLowerCase();
      try {
        await supabase.auth.updateUser({ email: newEmail });
      } catch (authErr: any) {
        console.warn('Advertencia actualizando email en auth:', authErr.message);
      }

      if (userId && userId !== '1') {
        const { error: pErr } = await supabase
          .from('profiles')
          .update({
            email: newEmail,
            nombre: updates.nombre || undefined,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (pErr) console.warn('Error actualizando perfil:', pErr.message);

        try {
          await supabase.rpc('update_user_email', {
            target_user_id: userId,
            new_email: newEmail
          });
        } catch (_) {}
      }
    } else if (updates.nombre && userId && userId !== '1') {
      await supabase
        .from('profiles')
        .update({
          nombre: updates.nombre,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    }
    return true;
  }
};
