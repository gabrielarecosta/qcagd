import { supabase } from './supabaseClient';
import { Customer, CustomerAddress } from '../types/client';

const mapCustomer = (d: any): Customer => ({
  id: d.id,
  nombre: d.nombre,
  razonSocial: d.razon_social || undefined,
  cuit: d.cuit || undefined,
  telefono: d.telefono,
  whatsapp: d.whatsapp || undefined,
  email: d.email || undefined,
  direccion: d.direccion,
  branchId: d.branch_id,
  tipoCliente: d.tipo_cliente,
  activo: d.activo,
  observaciones: d.observaciones || undefined,
  fechaAlta: d.fecha_alta,
  latitude: d.latitude ? Number(d.latitude) : undefined,
  longitude: d.longitude ? Number(d.longitude) : undefined,
  locationVerified: d.location_verified || false,
});

const CUSTOMER_COLUMNS = 'id, nombre, razon_social, cuit, telefono, whatsapp, email, direccion, branch_id, tipo_cliente, activo, observaciones, fecha_alta, latitude, longitude, location_verified';

export const clientService = {
  getAll: async (branchId?: string): Promise<Customer[]> => {
    let query = supabase.from('customers').select(CUSTOMER_COLUMNS).is('deleted_at', null);
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
      .select(CUSTOMER_COLUMNS)
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
      branch_id: updates.branchId,
      tipo_cliente: updates.tipoCliente,
      activo: updates.activo,
      observaciones: updates.observaciones,
      latitude: updates.latitude,
      longitude: updates.longitude,
      location_verified: updates.locationVerified ?? (updates.latitude ? true : undefined),
      updated_at: new Date().toISOString(),
    };

    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const { data, error } = await supabase
      .from('customers')
      .update(dbUpdates)
      .eq('id', id)
      .select(CUSTOMER_COLUMNS)
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
      branch_id: client.branchId,
      tipo_cliente: client.tipoCliente ?? 'minorista',
      activo: client.activo ?? true,
      observaciones: client.observaciones,
      latitude: client.latitude,
      longitude: client.longitude,
      location_verified: client.latitude ? true : false,
      fecha_alta: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('customers')
      .insert(dbInsert)
      .select(CUSTOMER_COLUMNS)
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
  },

  getAddresses: async (customerId: string): Promise<CustomerAddress[]> => {
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', customerId)
      .order('default_address', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapAddress);
  },

  addAddress: async (address: Omit<CustomerAddress, 'id'>): Promise<CustomerAddress> => {
    const dbInsert = {
      customer_id: address.customerId,
      direccion: address.direccion,
      indicaciones: address.indicaciones,
      latitude: address.latitude,
      longitude: address.longitude,
      location_verified: address.locationVerified ?? false,
      default_address: address.defaultAddress ?? false,
    };

    if (address.defaultAddress) {
      await supabase
        .from('customer_addresses')
        .update({ default_address: false })
        .eq('customer_id', address.customerId);
    }

    const { data, error } = await supabase
      .from('customer_addresses')
      .insert(dbInsert)
      .select('*')
      .single();

    if (error) throw error;
    return mapAddress(data);
  },

  deleteAddress: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('customer_addresses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  updateAddress: async (id: string, updates: Partial<CustomerAddress>): Promise<CustomerAddress> => {
    const dbUpdates: any = {
      direccion: updates.direccion,
      indicaciones: updates.indicaciones,
      latitude: updates.latitude,
      longitude: updates.longitude,
      location_verified: updates.locationVerified,
      default_address: updates.defaultAddress,
    };
    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const { data, error } = await supabase
      .from('customer_addresses')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return mapAddress(data);
  },

  setDefaultAddress: async (customerId: string, id: string): Promise<boolean> => {
    await supabase
      .from('customer_addresses')
      .update({ default_address: false })
      .eq('customer_id', customerId);

    const { error } = await supabase
      .from('customer_addresses')
      .update({ default_address: true })
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};

const mapAddress = (a: any): CustomerAddress => ({
  id: a.id,
  customerId: a.customer_id,
  direccion: a.direccion,
  indicaciones: a.indicaciones || undefined,
  latitude: a.latitude ? Number(a.latitude) : undefined,
  longitude: a.longitude ? Number(a.longitude) : undefined,
  locationVerified: a.location_verified || false,
  defaultAddress: a.default_address || false,
  createdAt: a.created_at,
});
