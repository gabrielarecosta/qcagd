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
  ctaCteAutorizada: d.cta_cte_autorizada ?? false,
  limiteCredito: d.limite_credito ? Number(d.limite_credito) : 0,
  mayoristaAutorizado: d.mayorista_autorizado ?? (d.tipo_cliente !== 'mayorista' && d.tipo_cliente !== 'sucursal'),
});

import { parseBranchId } from '../utils/branchUtils';

const CUSTOMER_COLUMNS = '*';

export const clientService = {
  getAll: async (branchId?: string | number): Promise<Customer[]> => {
    let query = supabase.from('customers').select(CUSTOMER_COLUMNS).is('deleted_at', null);
    const bId = parseBranchId(branchId);
    if (bId !== undefined) {
      query = query.eq('branch_id', bId);
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
      branch_id: updates.branchId ? parseBranchId(updates.branchId) : undefined,
      tipo_cliente: updates.tipoCliente,
      activo: updates.activo,
      observaciones: updates.observaciones,
      latitude: updates.latitude,
      longitude: updates.longitude,
      location_verified: updates.locationVerified ?? (updates.latitude ? true : undefined),
      cta_cte_autorizada: updates.ctaCteAutorizada,
      limite_credito: updates.limiteCredito,
      mayorista_autorizado: updates.mayoristaAutorizado,
      updated_at: new Date().toISOString(),
    };

    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    let { data, error } = await supabase
      .from('customers')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error && error.message?.includes('column')) {
      delete dbUpdates.cta_cte_autorizada;
      delete dbUpdates.limite_credito;
      delete dbUpdates.mayorista_autorizado;
      const { data: retryData, error: retryErr } = await supabase
        .from('customers')
        .update(dbUpdates)
        .eq('id', id)
        .select('*')
        .single();
      if (retryErr) throw retryErr;
      data = { 
        ...retryData, 
        cta_cte_autorizada: updates.ctaCteAutorizada, 
        limite_credito: updates.limiteCredito, 
        mayorista_autorizado: updates.mayoristaAutorizado 
      };
    } else if (error) {
      throw error;
    }

    return mapCustomer(data);
  },

  create: async (client: Omit<Customer, 'id' | 'fechaAlta'> & { id?: string | number }): Promise<Customer> => {
    let branchIdNum: number = 1;
    if (client.branchId) {
      if (typeof client.branchId === 'number') {
        branchIdNum = client.branchId;
      } else {
        const parsed = parseInt(String(client.branchId), 10);
        if (!isNaN(parsed)) branchIdNum = parsed;
      }
    }

    const dbInsert: any = {
      nombre: client.nombre,
      razon_social: client.razonSocial ? client.razonSocial : null,
      cuit: client.cuit ? client.cuit : null,
      telefono: client.telefono,
      whatsapp: client.whatsapp ? client.whatsapp : null,
      email: client.email ? client.email : null,
      direccion: client.direccion || '',
      branch_id: branchIdNum,
      tipo_cliente: client.tipoCliente ?? 'minorista',
      activo: client.activo ?? true,
      observaciones: client.observaciones ? client.observaciones : null,
      latitude: client.latitude || null,
      longitude: client.longitude || null,
      location_verified: client.latitude ? true : false,
      fecha_alta: new Date().toISOString(),
    };

    if (client.id && !isNaN(Number(client.id))) {
      dbInsert.id = Number(client.id);
    }

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
