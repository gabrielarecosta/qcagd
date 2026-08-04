import { supabase } from './supabaseClient';
import { DeliveryRoute, DeliveryStatus, DeliveryStop } from '../types/delivery';

const mapRoute = (r: any, deliveries: any[] = [], events: any[] = []): DeliveryRoute => {
  const stops: DeliveryStop[] = (deliveries || []).map(d => {
    const order = d.orders;
    const customer = order?.customers;
    
    // Find the latest delivery event for this client in the route
    const event = (events || [])
      .filter(ev => ev.cliente_id === order?.cliente_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return {
      clienteId: order?.cliente_id || '',
      clienteNombre: customer?.nombre || 'Cliente Desconocido',
      direccion: customer?.direccion || 'Sin dirección',
      completado: event ? event.completado : false,
      horaReal: event?.hora_real || undefined,
      motivoNoEntrega: event?.motivo_no_entrega || undefined,
    };
  });

  return {
    id: r.id,
    branchId: r.branch_id,
    repartidorId: r.repartidor_id,
    fecha: r.fecha,
    estado: r.estado as DeliveryStatus,
    zona: r.zona,
    horarioEstimado: r.horario_estimado || '',
    pedidosIds: (deliveries || []).map(d => d.order_id),
    stops,
    observaciones: r.observaciones || undefined,
    plannedBy: r.planned_by || undefined,
  };
};


export const deliveryService = {
  getAll: async (branchId?: string): Promise<DeliveryRoute[]> => {
    let query = supabase.from('delivery_routes').select('*');
    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }
    const { data: routes, error: routeErr } = await query.order('fecha', { ascending: false });
    if (routeErr) throw routeErr;

    if (!routes || routes.length === 0) return [];

    const routeIds = routes.map(r => r.id);

    // Fetch deliveries with joined orders and customer info
    const { data: deliveries, error: delivErr } = await supabase
      .from('deliveries')
      .select('route_id, order_id, orders(cliente_id, customers(nombre, direccion))')
      .in('route_id', routeIds)
      .order('secuencia', { ascending: true });

    if (delivErr) throw delivErr;

    // Fetch delivery events
    const { data: events, error: eventErr } = await supabase
      .from('delivery_events')
      .select('*')
      .in('route_id', routeIds);

    if (eventErr) throw eventErr;

    return routes.map(r => {
      const rDeliveries = (deliveries || []).filter(d => d.route_id === r.id);
      const rEvents = (events || []).filter(e => e.route_id === r.id);
      return mapRoute(r, rDeliveries, rEvents);
    });
  },

  getById: async (id: string): Promise<DeliveryRoute | undefined> => {
    const { data: r, error: routeErr } = await supabase
      .from('delivery_routes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (routeErr) throw routeErr;
    if (!r) return undefined;

    const { data: deliveries, error: delivErr } = await supabase
      .from('deliveries')
      .select('route_id, order_id, orders(cliente_id, customers(nombre, direccion))')
      .eq('route_id', id)
      .order('secuencia', { ascending: true });

    if (delivErr) throw delivErr;

    const { data: events, error: eventErr } = await supabase
      .from('delivery_events')
      .select('*')
      .eq('route_id', id);

    if (eventErr) throw eventErr;

    return mapRoute(r, deliveries || [], events || []);
  },

  getByDelivererId: async (delivererId: string): Promise<DeliveryRoute[]> => {
    const { data: routes, error: routeErr } = await supabase
      .from('delivery_routes')
      .select('*')
      .eq('repartidor_id', delivererId)
      .order('fecha', { ascending: false });

    if (routeErr) throw routeErr;
    if (!routes || routes.length === 0) return [];

    const routeIds = routes.map(r => r.id);

    const { data: deliveries, error: delivErr } = await supabase
      .from('deliveries')
      .select('route_id, order_id, orders(cliente_id, customers(nombre, direccion))')
      .in('route_id', routeIds)
      .order('secuencia', { ascending: true });

    if (delivErr) throw delivErr;

    const { data: events, error: eventErr } = await supabase
      .from('delivery_events')
      .select('*')
      .in('route_id', routeIds);

    if (eventErr) throw eventErr;

    return routes.map(r => {
      const rDeliveries = (deliveries || []).filter(d => d.route_id === r.id);
      const rEvents = (events || []).filter(e => e.route_id === r.id);
      return mapRoute(r, rDeliveries, rEvents);
    });
  },

  updateStatus: async (id: string, status: DeliveryStatus, obs?: string): Promise<DeliveryRoute> => {
    const { data: updated, error } = await supabase
      .from('delivery_routes')
      .update({
        estado: status,
        observaciones: obs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    
    const routeInfo = await deliveryService.getById(id);
    if (!routeInfo) throw new Error('Ruta no encontrada tras actualizar');
    return routeInfo;
  },

  updateStop: async (
    deliveryId: string, // route_id
    clienteId: string,
    completado: boolean,
    horaReal?: string,
    motivoNoEntrega?: string,
    receptorNombre?: string,
    observaciones?: string,
    userMail?: string
  ): Promise<DeliveryRoute> => {
    // 1. Registrar evento de entrega en Supabase (Auditoría e Historial de eventos)
    const { error: eventErr } = await supabase
      .from('delivery_events')
      .insert({
        route_id: deliveryId,
        cliente_id: clienteId,
        evento: completado ? 'ENTREGA_CONFIRMADA' : (motivoNoEntrega === 'Reprogramado' ? 'REPROGRAMADO' : 'NO_ENTREGADO'),
        completado,
        hora_real: horaReal || new Date().toLocaleTimeString(),
        motivo_no_entrega: motivoNoEntrega,
        receptor_nombre: receptorNombre,
        observaciones,
      });

    if (eventErr) throw eventErr;

    // 2. Buscar qué orden de la ruta corresponde a este cliente y actualizar su estado en Supabase
    const { data: deliveries, error: delivErr } = await supabase
      .from('deliveries')
      .select('order_id, orders(id, cliente_id)')
      .eq('route_id', deliveryId);

    if (delivErr) throw delivErr;

    const targetDelivery = (deliveries || []).find(d => d.orders && (d.orders as any).cliente_id === clienteId);
    if (targetDelivery && targetDelivery.order_id) {
      const orderId = targetDelivery.order_id;
      const nextOrderStatus = completado 
        ? 'entregado' 
        : (motivoNoEntrega === 'Reprogramado' ? 'reprogramado' : 'pendiente_de_entrega');

      // Actualizar pedido en Supabase
      const { error: orderErr } = await supabase
        .from('orders')
        .update({
          estado: nextOrderStatus,
          observaciones: observaciones,
          payment_status: completado ? 'pagado' : undefined,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (orderErr) throw orderErr;

      // Si completado, generar remito (receipts)
      if (completado) {
        const { error: receiptErr } = await supabase
          .from('receipts')
          .insert({
            order_id: orderId,
            numero_remito: `REM-${orderId.slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`,
            receptor_nombre: receptorNombre || 'Cliente o Vecino',
          });
        if (receiptErr) console.error('Error creating receipt:', receiptErr);
      }
    }

    // 3. Evaluar si todas las paradas de la ruta fueron procesadas
    const fullRoute = await deliveryService.getById(deliveryId);
    if (!fullRoute) throw new Error('Ruta no encontrada');

    const allStopsProcessed = fullRoute.stops.every(s => s.completado || s.motivoNoEntrega);
    if (allStopsProcessed) {
      await supabase
        .from('delivery_routes')
        .update({ estado: 'entregado', updated_at: new Date().toISOString() })
        .eq('id', deliveryId);
      fullRoute.estado = 'entregado';
    }

    return fullRoute;
  },

  create: async (route: Omit<DeliveryRoute, 'id'>): Promise<DeliveryRoute> => {
    const routeId = `deliv-${Date.now()}`;

    // 1. Insert header
    const { data: insertedRoute, error: routeErr } = await supabase
      .from('delivery_routes')
      .insert({
        id: routeId,
        branch_id: route.branchId,
        repartidor_id: route.repartidorId,
        fecha: route.fecha,
        estado: route.estado || 'pendiente',
        zona: route.zona,
        horario_estimado: route.horarioEstimado,
        observaciones: route.observaciones,
        planned_by: route.plannedBy,
      })
      .select('*')
      .single();


    if (routeErr) throw routeErr;

    // 2. Insert deliveries/stops
    const dbDeliveries = route.stops.map((stop, index) => {
      // Find the corresponding order ID from pedidosIds
      const orderId = route.pedidosIds[index] || '';
      return {
        route_id: routeId,
        order_id: orderId,
        estado: 'pendiente',
        secuencia: index + 1,
      };
    });

    const { error: delivErr } = await supabase
      .from('deliveries')
      .insert(dbDeliveries);

    if (delivErr) {
      await supabase.from('delivery_routes').delete().eq('id', routeId);
      throw delivErr;
    }

    // Update orders assigned to this route
    for (const orderId of route.pedidosIds) {
      await supabase
        .from('orders')
        .update({
          estado: 'asignado',
          repartidor_id: route.repartidorId,
          delivery_route_id: routeId,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
    }

    const createdRoute = await deliveryService.getById(routeId);
    if (!createdRoute) throw new Error('Error al recuperar ruta creada');
    return createdRoute;
  }
};
