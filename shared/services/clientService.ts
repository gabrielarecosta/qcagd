import { supabase } from './supabaseClient';
import { Customer, CustomerAddress } from '../types/client';

const mapCustomer = (d: any): Customer => ({
  id: d.id,
  userId: d.user_id || undefined,
  nombre: d.nombre,
  razonSocial: d.razon_social || undefined,
  cuit: d.cuit || undefined,
  telefono: d.telefono,
  whatsapp: d.whatsapp || undefined,
  email: d.email || undefined,
  direccion: d.direccion,
  localidad: d.localidad || undefined,
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
  passwordPlain: d.password || d.password_plain || undefined,
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

  getById: async (id: string | number): Promise<Customer | undefined> => {
    const strId = String(id).trim();
    const isNum = /^\d+$/.test(strId);
    let query = supabase.from('customers').select(CUSTOMER_COLUMNS).is('deleted_at', null);
    if (isNum) {
      query = query.eq('id', Number(strId));
    } else {
      query = query.eq('user_id', strId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.warn('Error en clientService.getById:', error.message);
      return undefined;
    }
    return data ? mapCustomer(data) : undefined;
  },

  update: async (id: string | number, updates: Partial<Customer>): Promise<Customer> => {
    const dbUpdates: any = {
      user_id: updates.userId,
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
      password: updates.passwordPlain,
      password_plain: updates.passwordPlain,
      updated_at: new Date().toISOString(),
    };

    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const isNum = /^\d+$/.test(String(id));
    let query = supabase.from('customers').update(dbUpdates);
    if (isNum) {
      query = query.eq('id', Number(id));
    } else {
      query = query.eq('user_id', String(id));
    }

    let { data, error } = await query.select('*').maybeSingle();

    if (error && error.message?.includes('column')) {
      delete dbUpdates.user_id;
      delete dbUpdates.cta_cte_autorizada;
      delete dbUpdates.limite_credito;
      delete dbUpdates.mayorista_autorizado;
      let retryQuery = supabase.from('customers').update(dbUpdates);
      if (isNum) {
        retryQuery = retryQuery.eq('id', Number(id));
      } else {
        retryQuery = retryQuery.eq('user_id', String(id));
      }
      const { data: retryData, error: retryErr } = await retryQuery.select('*').maybeSingle();
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

  create: async (client: Omit<Customer, 'id' | 'fechaAlta'> & { id?: string | number; userId?: string }): Promise<Customer> => {
    let branchIdNum: number = 1;
    if (client.branchId) {
      if (typeof client.branchId === 'number') {
        branchIdNum = client.branchId;
      } else {
        const parsed = parseInt(String(client.branchId), 10);
        if (!isNaN(parsed)) branchIdNum = parsed;
      }
    }

    const targetUserId = client.userId || (typeof client.id === 'string' && client.id.includes('-') ? client.id : null);

    const dbInsert: any = {
      user_id: targetUserId,
      nombre: client.nombre,
      razon_social: client.razonSocial ? client.razonSocial : null,
      cuit: client.cuit ? client.cuit : null,
      telefono: client.telefono,
      whatsapp: client.whatsapp ? client.whatsapp : null,
      email: client.email ? client.email : null,
      direccion: client.direccion || '',
      localidad: client.localidad || null,
      branch_id: branchIdNum,
      tipo_cliente: client.tipoCliente ?? 'minorista',
      activo: client.activo ?? true,
      observaciones: client.observaciones ? client.observaciones : null,
      latitude: client.latitude || null,
      longitude: client.longitude || null,
      location_verified: client.latitude ? true : false,
      fecha_alta: new Date().toISOString(),
      password: (client as any).passwordPlain || null,
      password_plain: (client as any).passwordPlain || null,
    };

    if (client.id && !isNaN(Number(client.id))) {
      dbInsert.id = Number(client.id);
    }

    let { data, error } = await supabase
      .from('customers')
      .upsert(dbInsert, { onConflict: 'email' })
      .select(CUSTOMER_COLUMNS)
      .single();

    if (error && error.message?.includes('user_id')) {
      delete dbInsert.user_id;
      const { data: retryData, error: retryErr } = await supabase
        .from('customers')
        .upsert(dbInsert, { onConflict: 'email' })
        .select(CUSTOMER_COLUMNS)
        .single();
      if (retryErr) throw retryErr;
      data = retryData;
    } else if (error) {
      // Si el error es 23505 o duplicate key por otra vía, intentar obtener el registro existente
      if (error.code === '23505' || error.message?.includes('duplicate key')) {
        const { data: existingData } = await supabase
          .from('customers')
          .select(CUSTOMER_COLUMNS)
          .eq('email', client.email)
          .maybeSingle();

        if (existingData) return mapCustomer(existingData);
      }
      throw error;
    }

    return mapCustomer(data);
  },


  delete: async (id: string | number, deletedBy?: string): Promise<boolean> => {
    const strId = String(id).trim();
    const isNum = /^\d+$/.test(strId);
    let query = supabase
      .from('customers')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy || 'admin',
        activo: false
      });

    if (isNum) {
      query = query.eq('id', Number(strId));
    } else {
      query = query.eq('user_id', strId);
    }

    const { error } = await query;
    if (error) throw error;
    return true;
  },

  getAddresses: async (customerId: string | number): Promise<CustomerAddress[]> => {
    if (!customerId) return [];
    try {
      const { numericId, uuid } = await resolveCustomerDbId(customerId);

      if (numericId !== undefined) {
        const { data, error } = await supabase
          .from('customer_addresses')
          .select('*')
          .eq('customer_id', numericId)
          .order('default_address', { ascending: false })
          .order('created_at', { ascending: true });

        if (!error && data) {
          return data.map(mapAddress);
        }
      }

      // Solo si la columna en DB admitiera UUIDs (sin arrojar error si falla)
      if (uuid && numericId === undefined) {
        try {
          const { data, error } = await supabase
            .from('customer_addresses')
            .select('*')
            .eq('customer_id', uuid)
            .order('default_address', { ascending: false })
            .order('created_at', { ascending: true });

          if (!error && data) {
            return data.map(mapAddress);
          }
        } catch (_) {}
      }

      return [];
    } catch (err) {
      console.warn('Error al obtener direcciones de cliente:', err);
      return [];
    }
  },

  addAddress: async (address: Omit<CustomerAddress, 'id'>): Promise<CustomerAddress> => {
    const { numericId, uuid } = await resolveCustomerDbId(address.customerId);
    const targetCustomerId = numericId !== undefined ? numericId : (uuid || address.customerId);

    const dbInsert: any = {
      customer_id: targetCustomerId,
      direccion: address.direccion,
      indicaciones: address.indicaciones,
      latitude: address.latitude,
      longitude: address.longitude,
      location_verified: address.locationVerified ?? false,
      default_address: address.defaultAddress ?? false,
    };

    if (address.defaultAddress) {
      try {
        await supabase
          .from('customer_addresses')
          .update({ default_address: false })
          .eq('customer_id', targetCustomerId);
      } catch (_) {}
    }

    let { data, error } = await supabase
      .from('customer_addresses')
      .insert(dbInsert)
      .select('*')
      .single();

    // Si falló por 22P02 porque la columna es BIGINT y targetCustomerId era UUID:
    if (error && error.code === '22P02' && uuid && numericId === undefined) {
      const { data: cust } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', uuid)
        .maybeSingle();

      if (cust?.id) {
        dbInsert.customer_id = cust.id;
        const retry = await supabase
          .from('customer_addresses')
          .insert(dbInsert)
          .select('*')
          .single();
        if (!retry.error && retry.data) {
          return mapAddress(retry.data);
        }
      }
    }

    if (error) throw error;
    return mapAddress(data);
  },

  deleteAddress: async (id: string | number): Promise<boolean> => {
    const { error } = await supabase
      .from('customer_addresses')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  updateAddress: async (id: string | number, updates: Partial<CustomerAddress>): Promise<CustomerAddress> => {
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
      .eq('id', id);

    if (error) throw error;
    return mapAddress(data);
  },

  setDefaultAddress: async (customerId: string | number, id: string | number): Promise<boolean> => {
    const { numericId, uuid } = await resolveCustomerDbId(customerId);
    const targetCustomerId = numericId !== undefined ? numericId : (uuid || customerId);

    try {
      await supabase
        .from('customer_addresses')
        .update({ default_address: false })
        .eq('customer_id', targetCustomerId);
    } catch (_) {}

    const { error } = await supabase
      .from('customer_addresses')
      .update({ default_address: true })
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  updatePassword: async (customerId: string | number, newPassword: string): Promise<boolean> => {
    if (!newPassword || newPassword.trim().length < 4) {
      throw new Error('La contraseña debe tener al menos 4 caracteres.');
    }
    const cleanPass = newPassword.trim();
    // 1. Intentar RPC admin_set_customer_password si está disponible
    try {
      const { error: rpcErr } = await supabase.rpc('admin_set_customer_password', {
        target_customer_id: String(customerId),
        new_password: cleanPass
      });
      if (!rpcErr) return true;
    } catch (_) {}

    // 2. Intentar RPC update_user_password con target_user_id si el cliente tiene user_id
    try {
      const isNum = /^\d+$/.test(String(customerId));
      let custQuery = supabase.from('customers').select('user_id');
      if (isNum) custQuery = custQuery.eq('id', Number(customerId)); else custQuery = custQuery.eq('user_id', String(customerId));
      const { data: cust } = await custQuery.maybeSingle();
      if (cust?.user_id) {
        await supabase.rpc('update_user_password', {
          target_user_id: cust.user_id,
          new_password: cleanPass
        });
      }
    } catch (_) {}

    // 3. Actualización directa en la tabla customers
    const isNum = /^\d+$/.test(String(customerId));
    let query = supabase.from('customers').update({ password: cleanPass, password_plain: cleanPass });
    if (isNum) {
      query = query.eq('id', Number(customerId));
    } else {
      query = query.eq('user_id', String(customerId));
    }
    const { error } = await query;
    if (error && error.message?.includes('column')) {
      try {
        let q1 = supabase.from('customers').update({ password: cleanPass });
        if (isNum) await q1.eq('id', Number(customerId)); else await q1.eq('user_id', String(customerId));
      } catch (_) {}
      try {
        let q2 = supabase.from('customers').update({ password_plain: cleanPass });
        if (isNum) await q2.eq('id', Number(customerId)); else await q2.eq('user_id', String(customerId));
      } catch (_) {}
    }
    return true;
  }
};

const resolveCustomerDbId = async (customerId: string | number): Promise<{ numericId?: number; uuid?: string }> => {
  const strId = String(customerId).trim();
  if (/^\d+$/.test(strId)) {
    return { numericId: parseInt(strId, 10) };
  }
  // Es un UUID
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, user_id')
      .eq('user_id', strId)
      .maybeSingle();

    if (!error && data?.id) {
      const parsed = typeof data.id === 'number' ? data.id : parseInt(String(data.id), 10);
      if (!isNaN(parsed)) {
        return { numericId: parsed, uuid: strId };
      }
    }
  } catch (_) {}
  return { uuid: strId };
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
