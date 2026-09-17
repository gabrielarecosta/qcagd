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

    let data: any = null;
    let error: any = null;

    const res = await supabase
      .from('branches')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();

    data = res.data;
    error = res.error;

    // Si Supabase aún no tiene algunas columnas en el schema cache (PGRST204), reintentar sin las columnas opcionales
    if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
      const fallbackUpdates = { ...dbUpdates };
      delete fallbackUpdates.localidad;
      delete fallbackUpdates.permite_venta_online;
      delete fallbackUpdates.permite_venta_presencial;
      delete fallbackUpdates.permite_reparto;
      delete fallbackUpdates.tipo_sucursal;

      const retryRes = await supabase
        .from('branches')
        .update(fallbackUpdates)
        .eq('id', id)
        .select('*')
        .single();
      
      data = retryRes.data;
      error = retryRes.error;
    }

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

    let data: any = null;
    let error: any = null;

    const res = await supabase
      .from('branches')
      .insert(dbInsert)
      .select('*')
      .single();

    data = res.data;
    error = res.error;

    if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
      const fallbackInsert = { ...dbInsert };
      delete fallbackInsert.localidad;
      delete fallbackInsert.permite_venta_online;
      delete fallbackInsert.permite_venta_presencial;
      delete fallbackInsert.permite_reparto;
      delete fallbackInsert.tipo_sucursal;

      const retryRes = await supabase
        .from('branches')
        .insert(fallbackInsert)
        .select('*')
        .single();

      data = retryRes.data;
      error = retryRes.error;
    }

    if (error) throw error;
    return mapBranch(data);
  }

};


