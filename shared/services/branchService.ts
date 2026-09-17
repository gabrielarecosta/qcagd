import { supabase } from './supabaseClient';
import { Branch } from '../types/branch';

const mapBranch = (d: any): Branch => ({
  id: d.id,
  nombre: d.nombre,
  direccion: d.direccion || '',
  localidad: d.localidad || d.direccion?.split(',')[1]?.trim() || 'General Deheza',
  telefono: d.telefono || '',
  whatsapp: d.whatsapp || '',
  horarioAtencion: d.horario_atencion || '',
  activo: d.activo !== false,
  permiteVentaOnline: d.permite_venta_online !== false,
  permiteVentaPresencial: d.permite_venta_presencial !== false,
  permiteReparto: d.permite_reparto !== false,
  tipoSucursal: d.tipo_sucursal || 'sucursal_completa',
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

  getOnlineSalesBranches: async (): Promise<Branch[]> => {
    const all = await branchService.getAll();
    return all.filter(b => b.activo && b.permiteVentaOnline !== false && b.tipoSucursal !== 'deposito');
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
      localidad: updates.localidad,
      telefono: updates.telefono,
      whatsapp: updates.whatsapp,
      horario_atencion: updates.horarioAtencion,
      activo: updates.activo,
      permite_venta_online: updates.permiteVentaOnline,
      permite_venta_presencial: updates.permiteVentaPresencial,
      permite_reparto: updates.permiteReparto,
      tipo_sucursal: updates.tipoSucursal,
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
      localidad: branch.localidad || 'General Deheza',
      telefono: branch.telefono,
      whatsapp: branch.whatsapp,
      horario_atencion: branch.horarioAtencion,
      activo: branch.activo ?? true,
      permite_venta_online: branch.permiteVentaOnline ?? true,
      permite_venta_presencial: branch.permiteVentaPresencial ?? true,
      permite_reparto: branch.permiteReparto ?? true,
      tipo_sucursal: branch.tipoSucursal || 'sucursal_completa',
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


