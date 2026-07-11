import { supabase } from './supabaseClient';
import { Order, OrderStatus } from '../types/order';
import { OrderItem } from '../types/orderItem';
import { PaymentMethod, PaymentStatus } from '../types/payment';

const mapOrderItem = (i: any): OrderItem => ({
  producto: {
    id: i.product_id,
    codigo: i.codigo,
    nombre: i.nombre,
    presentacion: i.presentacion || '',
    precio: Number(i.precio_unitario),
    categoria: 'limpieza', // default fallback, will be hydrated from product if needed
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
  paymentMethod: o.payment_method as PaymentMethod,
  paymentStatus: o.payment_status as PaymentStatus,
  abonaCon: o.abona_con ? Number(o.abona_con) : undefined,
  cambioEstimado: o.cambio_estimado ? Number(o.cambio_estimado) : undefined,
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

    // Fetch all items for these orders
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

    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);

    if (itemsErr) throw itemsErr;

    return mapOrder(o, items || []);
  },

  updateStatus: async (id: string, status: OrderStatus, notes?: string, userMail?: string): Promise<Order> => {
    // Si se pasa userMail, configurar la variable de sesión para el trigger/auditoría
    if (userMail) {
      await supabase.rpc('set_config', { placeholder: 'app.current_user_email', value: userMail, is_local: false });
    }

    const { data: updated, error } = await supabase
      .from('orders')
      .update({
        estado: status,
        observaciones: notes,
        payment_status: status === 'entregado' ? 'pagado' : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    // Fetch order items to reconstruct full Order object
    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);

    if (itemsErr) throw itemsErr;
    return mapOrder(updated, items || []);
  },

  update: async (id: string, updates: Partial<Order> & { estimatedDeliveryShift?: 'mañana' | 'tarde', deliveryZone?: string, deliveryRouteId?: string }, userMail?: string): Promise<Order> => {
    if (userMail) {
      await supabase.rpc('set_config', { placeholder: 'app.current_user_email', value: userMail, is_local: false });
    }

    const dbUpdates: any = {
      estado: updates.estado,
      observaciones: updates.observaciones,
      observaciones_cliente: updates.observacionesCliente,
      repartidor_id: updates.repartidorId,
      estimated_delivery_date: updates.estimatedDelivery,
      estimated_delivery_shift: updates.estimatedDeliveryShift,
      delivery_zone: updates.deliveryZone,
      delivery_route_id: updates.deliveryRouteId,
      payment_method: updates.paymentMethod,
      payment_status: updates.paymentStatus,
      abona_con: updates.abonaCon,
      cambio_estimado: updates.cambioEstimado,
      total: updates.total,
      updated_at: new Date().toISOString(),
    };

    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const { data: updated, error } = await supabase
      .from('orders')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    // Fetch items
    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id);

    if (itemsErr) throw itemsErr;
    return mapOrder(updated, items || []);
  },

  create: async (order: Omit<Order, 'id'> & { id?: string, estimatedDeliveryShift?: 'mañana' | 'tarde', deliveryZone?: string }, userMail?: string): Promise<Order> => {
    const orderId = order.id || `ord-${Date.now()}`;
    const orderNum = order.numero || `PED-${Date.now().toString().slice(-6)}`;

    if (userMail) {
      await supabase.rpc('set_config', { placeholder: 'app.current_user_email', value: userMail, is_local: false });
    }

    // 1. Insert header
    const dbOrder = {
      id: orderId,
      numero: orderNum,
      cliente_id: order.clienteId,
      branch_id: order.branchId,
      fecha: order.fecha || new Date().toISOString(),
      total: order.total,
      estado: order.estado || 'recibido',
      observaciones: order.observaciones,
      observaciones_cliente: order.observacionesCliente,
      repartidor_id: order.repartidorId,
      estimated_delivery_date: order.estimatedDelivery,
      estimated_delivery_shift: order.estimatedDeliveryShift,
      delivery_zone: order.deliveryZone,
      payment_method: order.paymentMethod || 'efectivo',
      payment_status: order.paymentStatus || 'pendiente',
      abona_con: order.abonaCon,
      cambio_estimado: order.cambioEstimado,
    };

    const { data: insertedOrder, error: orderErr } = await supabase
      .from('orders')
      .insert(dbOrder)
      .select('*')
      .single();

    if (orderErr) throw orderErr;

    // 2. Insert items
    const dbItems = order.items.map(item => ({
      order_id: orderId,
      product_id: item.producto.id,
      codigo: item.producto.codigo,
      nombre: item.producto.nombre,
      presentacion: item.producto.presentacion,
      precio_unitario: item.precioUnitario,
      cantidad: item.cantidad,
      subtotal: item.subtotal,
    }));

    const { data: insertedItems, error: itemsErr } = await supabase
      .from('order_items')
      .insert(dbItems)
      .select('*');

    if (itemsErr) {
      // Intentar limpiar cabecera si fallan los items (rollback manual en caso de no soportar transacciones complejas)
      await supabase.from('orders').delete().eq('id', orderId);
      throw itemsErr;
    }

    return mapOrder(insertedOrder, insertedItems || []);
  },

  delete: async (id: string, deletedBy?: string): Promise<boolean> => {
    const { error } = await supabase
      .from('orders')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy || 'admin',
        estado: 'cancelado'
      })
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};
