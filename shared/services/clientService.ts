import { supabase } from './supabaseClient';
import { Customer } from '../types/client';

const mapCustomer = (d: any): Customer => ({
  id: d.id,
  nombre: d.nombre,
  razonSocial: d.razon_social || undefined,
  cuit: d.cuit || undefined,
  telefono: d.telefono,
  whatsapp: d.whatsapp || undefined,
  email: d.email || undefined,
  direccion: d.direccion,
  zona: d.zona,
  branchId: d.branch_id,
  tipoCliente: d.tipo_cliente,
  activo: d.activo,
  observaciones: d.observaciones || undefined,
  fechaAlta: d.fecha_alta,
});

export const clientService = {
  getAll: async (branchId?: string): Promise<Customer[]> => {
    let query = supabase.from('customers').select('*').is('deleted_at', null);
    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapCustomer);
  },

  getById: async (id: string): Promise<Customer | undefined> => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) throw error;
    return data ? mapCustomer(data) : undefined;
  },

  update: async (id: string, updates: Partial<Customer>): Promise<Customer> => {
    const dbUpdates: any = {
      nombre: updates.nombre,
      razon_social: updates.razonSocial,
      cuit: updates.cuit,
      telefono: updates.telefono,
      whatsapp: updates.whatsapp,
      email: updates.email,
      direccion: updates.direccion,
      zona: updates.zona,
      branch_id: updates.branchId,
      tipo_cliente: updates.tipoCliente,
      activo: updates.activo,
      observaciones: updates.observaciones,
      updated_at: new Date().toISOString(),
    };

    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const { data, error } = await supabase
      .from('customers')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return mapCustomer(data);
  },

  create: async (client: Omit<Customer, 'id' | 'fechaAlta'> & { id?: string }): Promise<Customer> => {
    const clientId = client.id || `cli-${Date.now()}`;
    const dbInsert: any = {
      id: clientId,
      nombre: client.nombre,
      razon_social: client.razonSocial,
      cuit: client.cuit,
      telefono: client.telefono,
      whatsapp: client.whatsapp,
      email: client.email,
      direccion: client.direccion,
      zona: client.zona,
      branch_id: client.branchId,
      tipo_cliente: client.tipoCliente ?? 'minorista',
      activo: client.activo ?? true,
      observaciones: client.observaciones,
      fecha_alta: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('customers')
      .insert(dbInsert)
      .select('*')
      .single();
    if (error) throw error;
    return mapCustomer(data);
  },

  delete: async (id: string, deletedBy?: string): Promise<boolean> => {
    const { error } = await supabase
      .from('customers')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy || 'admin',
        activo: false
      })
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};
