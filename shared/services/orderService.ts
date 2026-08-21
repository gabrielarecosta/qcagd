import { supabase } from './supabaseClient';
import { Order, OrderStatus } from '../types/order';
import { OrderItem } from '../types/orderItem';
import { PaymentMethod, PaymentStatus } from '../types/payment';
import { geocodeAddress } from '../utils/geo';

const mapOrderItem = (i: any): OrderItem => ({
  producto: {
    id: i.product_id,
    codigo: i.codigo,
    nombre: i.nombre,
    presentacion: i.presentacion || '',
    precio: Number(i.precio_unitario),
    categoria: 'limpieza',
    unidad: 'unidad',
    activo: true,
  },
  cantidad: Number(i.cantidad),
  precioUnitario: Number(i.precio_unitario),
  subtotal: Number(i.subtotal),
});

const mapOrder = (o: any, items: any[] = []): Order => ({
  id: o.id,
  numero: o.numero,
  clienteId: o.cliente_id,
  branchId: o.branch_id,
  fecha: o.fecha,
  items: items.map(mapOrderItem),
  total: Number(o.total),
  estado: o.estado as OrderStatus,
  observaciones: o.observaciones || undefined,
  observacionesCliente: o.observaciones_cliente || undefined,
  repartidorId: o.repartidor_id || undefined,
  estimatedDelivery: o.estimated_delivery_date || undefined,
  estimatedDeliveryShift: o.estimated_delivery_shift || undefined,
  paymentMethod: o.payment_method as PaymentMethod,
  paymentStatus: o.payment_status as PaymentStatus,
  abonaCon: o.abona_con ? Number(o.abona_con) : undefined,
  cambioEstimado: o.cambio_estimado ? Number(o.cambio_estimado) : undefined,
  deliveryDate: o.delivery_date || undefined,
  deliveryStartTime: o.delivery_start_time || undefined,
  deliveryEndTime: o.delivery_end_time || undefined,
  deliveryTimeSlotId: o.delivery_time_slot_id || undefined,
  deliveryMethod: o.delivery_method || undefined,
  takenById: o.taken_by_id || undefined,
  takenAt: o.taken_at || undefined,
  deliveredAt: o.delivered_at || undefined,
  originalAddress: o.original_address || undefined,
  formattedAddress: o.formatted_address || undefined,
  street: o.street || undefined,
  streetNumber: o.street_number || undefined,
  city: o.city || 'General Deheza',
  province: o.province || 'Córdoba',
  latitude: o.latitude ? Number(o.latitude) : undefined,
  longitude: o.longitude ? Number(o.longitude) : undefined,
  addressReference: o.address_reference || undefined,
  locationVerified: o.location_verified || false,
  locationStatus: o.location_status || (o.latitude && o.longitude ? 'geocoded' : 'pending'),
  customerName: o.customer_name || o.customers?.nombre || (o.customers ? (o.customers.razon_social || o.customers.nombre) : undefined),
  customerPhone: o.customer_phone || o.customers?.telefono || o.customers?.whatsapp || undefined,
  outOfStockPreference: o.out_of_stock_preference || undefined,
  mpPreferenceId: o.mp_preference_id || undefined,
  mpInitPoint: o.mp_init_point || undefined,
  mpPreferenceExpiresAt: o.mp_preference_expires_at || undefined,
});

export const orderService = {
  getAll: async (branchId?: string): Promise<Order[]> => {
    let query = supabase.from('orders').select('*').is('deleted_at', null);
    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }
    const { data: ordersData, error: orderErr } = await query.order('fecha', { ascending: false });
    if (orderErr) throw orderErr;

    if (!ordersData || ordersData.length === 0) return [];

    const orderIds = ordersData.map((o: any) => o.id);
    const { data: itemsData, error: itemsErr } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds);

    if (itemsErr) throw itemsErr;

    return ordersData.map((o: any) => {
      const items = (itemsData || []).filter((item: any) => item.order_id === o.id);
      return mapOrder(o, items);
    });
  },

  getById: async (id: string): Promise<Order | undefined> => {
    const { data: o, error: orderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (orderErr) throw orderErr;
    if (!o) return undefined;

    const { data: itemsData, error: itemsErr } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);

    if (itemsErr) throw itemsErr;
    return mapOrder(o, itemsData || []);
  },

  updateStatus: async (id: string, status: OrderStatus, notes?: string, userMail?: string): Promise<Order> => {
    if (userMail) {
      await supabase.rpc('set_config', { placeholder: 'app.current_user_email', value: userMail, is_local: false });
    }

    const updatePayload: any = {
      estado: status,
      observaciones: notes,
      payment_status: status === 'entregado' ? 'pagado' : undefined,
      updated_at: new Date().toISOString(),
    };

    if (status === 'entregado') {
      updatePayload.delivered_at = new Date().toISOString();
    }

    const { data: updated, error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);

    if (itemsErr) throw itemsErr;
    return mapOrder(updated, items || []);
  },

  update: async (id: string, updates: Partial<Order> & { estimatedDeliveryShift?: 'mañana' | 'tarde', deliveryRouteId?: string }, userMail?: string): Promise<Order> => {
    if (userMail) {
      await supabase.rpc('set_config', { placeholder: 'app.current_user_email', value: userMail, is_local: false });
    }

    let lat = updates.latitude;
    let lon = updates.longitude;
    let locationStatus = updates.locationStatus;

    const dbUpdates: any = {
      estado: updates.estado,
      observaciones: updates.observaciones,
      observaciones_cliente: updates.observacionesCliente,
      repartidor_id: updates.repartidorId,
      estimated_delivery_date: updates.estimatedDelivery,
      estimated_delivery_shift: updates.estimatedDeliveryShift,
      delivery_route_id: updates.deliveryRouteId,
      payment_method: updates.paymentMethod,
      payment_status: updates.paymentStatus,
      abona_con: updates.abonaCon,
      cambio_estimado: updates.cambioEstimado,
      total: updates.total,
      delivery_date: updates.deliveryDate,
      delivery_start_time: updates.deliveryStartTime,
      delivery_end_time: updates.deliveryEndTime,
      delivery_time_slot_id: updates.deliveryTimeSlotId !== undefined && updates.deliveryTimeSlotId !== null && !isNaN(Number(updates.deliveryTimeSlotId)) ? Number(updates.deliveryTimeSlotId) : (updates.deliveryTimeSlotId === null ? null : undefined),
      delivery_method: updates.deliveryMethod,
      taken_by_id: updates.takenById,
      taken_at: updates.takenAt,
      delivered_at: updates.deliveredAt,
      original_address: updates.originalAddress,
      formatted_address: updates.formattedAddress,
      street: updates.street,
      street_number: updates.streetNumber,
      city: updates.city,
      province: updates.province,
      latitude: lat,
      longitude: lon,
      location_status: locationStatus,
      updated_at: new Date().toISOString(),
    };

    if (updates.estado === 'entregado') {
      dbUpdates.delivered_at = new Date().toISOString();
    }

    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const { data: updated, error } = await supabase
      .from('orders')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);

    if (itemsErr) throw itemsErr;
    return mapOrder(updated, items || []);
  },

  /**
   * Actualiza la ubicación (pin manual o geocodificado)
   */
  updateOrderCoordinates: async (
    orderId: string,
    params: {
      latitude: number;
      longitude: number;
      locationStatus?: 'manual_pin' | 'geocoded' | 'verified';
    }
  ): Promise<void> => {
    const { error } = await supabase
      .from('orders')
      .update({
        latitude: params.latitude,
        longitude: params.longitude,
        location_status: params.locationStatus || 'manual_pin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (error) {
      throw new Error(`Error al actualizar ubicación: ${error.message}`);
    }
  },

  create: async (order: Omit<Order, 'id'> & { id?: string, estimatedDeliveryShift?: 'mañana' | 'tarde' }, userMail?: string): Promise<Order> => {
    const orderId = order.id || `ord-${Date.now()}`;
    const orderNum = order.numero || Date.now().toString().slice(-6);

    if (userMail) {
      await supabase.rpc('set_config', { placeholder: 'app.current_user_email', value: userMail, is_local: false });
    }

    let lat = order.latitude;
    let lon = order.longitude;
    let locationStatus = order.locationStatus || 'pending';

    // Si no tiene coordenadas pero tiene dirección, intentar geocodificar automáticamente
    const addressToGeocode = order.formattedAddress || order.originalAddress;
    if ((!lat || !lon) && addressToGeocode) {
      try {
        const geoResult = await geocodeAddress(addressToGeocode, order.city || 'General Deheza', order.province || 'Córdoba');
        if (geoResult) {
          lat = geoResult.latitude;
          lon = geoResult.longitude;
          locationStatus = 'geocoded';
        }
      } catch (e) {
        console.warn('Geocodificación automática en creación falló:', e);
      }
    }

    const clienteIdNum = order.clienteId
      ? (typeof order.clienteId === 'number' ? order.clienteId : (isNaN(Number(order.clienteId)) ? null : Number(order.clienteId)))
      : null;

    const branchIdNum = order.branchId
      ? (typeof order.branchId === 'number' ? order.branchId : (isNaN(Number(order.branchId)) ? 1 : Number(order.branchId)))
      : 1;

    // 1. Insert header
    const dbOrder: any = {
      numero: orderNum,
      cliente_id: clienteIdNum,
      branch_id: branchIdNum,
      fecha: order.fecha || new Date().toISOString(),
      total: order.total,
      estado: order.estado || 'recibido',
      observaciones: order.observaciones,
      observaciones_cliente: order.observacionesCliente,
      repartidor_id: order.repartidorId,
      estimated_delivery_date: order.estimatedDelivery,
      estimated_delivery_shift: order.estimatedDeliveryShift,
      payment_method: order.paymentMethod || 'efectivo',
      payment_status: order.paymentStatus || 'pendiente',
      abona_con: order.abonaCon,
      cambio_estimado: order.cambioEstimado,
      delivery_date: order.deliveryDate,
      delivery_start_time: order.deliveryStartTime,
      delivery_end_time: order.deliveryEndTime,
      delivery_time_slot_id: order.deliveryTimeSlotId !== undefined && order.deliveryTimeSlotId !== null && !isNaN(Number(order.deliveryTimeSlotId)) ? Number(order.deliveryTimeSlotId) : null,
      delivery_method: order.deliveryMethod,
      original_address: order.originalAddress,
      formatted_address: order.formattedAddress,
      street: order.street,
      street_number: order.streetNumber,
      city: order.city || 'General Deheza',
      province: order.province || 'Córdoba',
      latitude: lat,
      longitude: lon,
      location_status: locationStatus,
      address_reference: order.addressReference,
      location_verified: order.locationVerified || locationStatus === 'geocoded',
      out_of_stock_preference: order.outOfStockPreference || 'llamar',
    };

    if (order.id && !isNaN(Number(order.id))) {
      dbOrder.id = Number(order.id);
    }

    let { data: insertedOrder, error: orderErr } = await supabase
      .from('orders')
      .insert(dbOrder)
      .select('*')
      .single();

    if (orderErr) {
      if (orderErr.code === 'PGRST204' || orderErr.message?.includes('schema cache')) {
        const missingMatch = orderErr.message?.match(/Could not find the '([^']+)' column/);
        if (missingMatch && missingMatch[1]) {
          delete (dbOrder as any)[missingMatch[1]];
          const { data: retryData, error: retryErr } = await supabase
            .from('orders')
            .insert(dbOrder)
            .select('*')
            .single();
          if (retryErr) throw retryErr;
          insertedOrder = retryData;
        } else {
          throw orderErr;
        }
      } else {
        throw orderErr;
      }
    }

    const realOrderId = insertedOrder.id;

    // 2. Insert items
    const dbItems = order.items.map((item) => {
      const prodIdNum = item.producto.id && !isNaN(Number(item.producto.id)) ? Number(item.producto.id) : null;
      return {
        order_id: realOrderId,
        product_id: prodIdNum,
        codigo: item.producto.codigo,
        nombre: item.producto.nombre,
        presentacion: item.producto.presentacion,
        precio_unitario: item.precioUnitario,
        cantidad: item.cantidad,
        subtotal: item.subtotal,
      };
    });

    if (dbItems.length > 0) {
      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(dbItems);
      if (itemsErr) throw itemsErr;
    }

    return mapOrder(insertedOrder, order.items);
  },

  delete: async (id: string, userMail?: string): Promise<void> => {
    if (userMail) {
      await supabase.rpc('set_config', { placeholder: 'app.current_user_email', value: userMail, is_local: false });
    }
    const { error } = await supabase
      .from('orders')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userMail || 'Sistema',
      })
      .eq('id', id);

    if (error) throw error;
  },

  updateMercadoPagoPreference: async (orderId: string, preferenceId: string, initPoint: string, expiresAt: string): Promise<void> => {
    const payload: any = {
      mp_preference_id: preferenceId,
      mp_init_point: initPoint,
      mp_preference_expires_at: expiresAt,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', orderId);
    if (error) {
      console.warn('Could not save mp_preference_id in orders table:', error.message);
    }
  }
};
