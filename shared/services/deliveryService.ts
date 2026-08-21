import { supabase } from './supabaseClient';
import { DeliveryRoute, DeliveryStatus, DeliveryStop } from '../types/delivery';

const mapRoute = (r: any, deliveries: any[] = [], events: any[] = [], ordersMap: Map<string, any> = new Map(), customersMap: Map<string, any> = new Map()): DeliveryRoute => {
  const stops: DeliveryStop[] = (deliveries || []).map((d, index) => {
    const orderId = d.order_id;
    const order = ordersMap.get(orderId) || d.orders;
    const customerId = order?.cliente_id || order?.customer_id;
    const customer = customersMap.get(customerId) || order?.customers;
    
    // Find the latest delivery event for this client in the route
    const event = (events || [])
      .filter(ev => ev.cliente_id === customerId || ev.route_id === r.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    return {
      clienteId: customerId || '',
      clienteNombre: customer?.nombre || customer?.razon_social || order?.customer_name || `Parada #${index + 1}`,
      direccion: customer?.direccion || order?.formatted_address || order?.original_address || 'Sin dirección',
      completado: event ? event.completado : (d.status === 'entregado' || d.completado || false),
      horaReal: event?.hora_real || d.hora_real || undefined,
      motivoNoEntrega: event?.motivo_no_entrega || d.motivo_no_entrega || undefined,
    };
  });

  const estadoNormalized: DeliveryStatus = (
    r.estado ||
    (r.status === 'completed' || r.status === 'entregado' ? 'entregado' :
     r.status === 'active' || r.status === 'en_camino' ? 'en_camino' :
     r.status === 'optimized' || r.status === 'confirmed' || r.status === 'armado' ? 'armado' : 'armado')
  ) as DeliveryStatus;

  return {
    id: r.id,
    branchId: r.branch_id ? (isNaN(Number(r.branch_id)) ? 1 : Number(r.branch_id)) : 1,
    repartidorId: r.repartidor_id || r.driver_id || '',
    fecha: r.fecha || r.date || new Date().toISOString().split('T')[0],
    estado: estadoNormalized,
    horarioEstimado: r.horario_estimado || '08:00 a 20:00',
    pedidosIds: (deliveries || []).map(d => d.order_id),
    stops,
    observaciones: r.observaciones || r.notes || undefined,
    plannedBy: r.planned_by || undefined,
  };
};

export const deliveryService = {
  getAll: async (branchId?: string): Promise<DeliveryRoute[]> => {
    try {
      let query = supabase.from('delivery_routes').select('*');
      if (branchId && branchId !== 'all') {
        query = query.eq('branch_id', branchId);
      }
      const { data: routes, error: routeErr } = await query.order('created_at', { ascending: false });
      if (routeErr) {
        console.warn('Error fetching delivery_routes:', routeErr);
        return [];
      }

      if (!routes || routes.length === 0) return [];

      const routeIds = routes.map(r => r.id);

      // 1. Fetch from deliveries table
      let deliveries: any[] = [];
      try {
        const { data: delivData } = await supabase
          .from('deliveries')
          .select('*')
          .in('route_id', routeIds)
          .order('secuencia', { ascending: true });
        deliveries = delivData || [];
      } catch (e) {
        console.warn('Error fetching deliveries:', e);
      }

      // 2. Also fetch from delivery_route_stops if deliveries was empty
      let routeStops: any[] = [];
      try {
        const { data: stopsData } = await supabase
          .from('delivery_route_stops')
          .select('*')
          .in('route_id', routeIds)
          .order('stop_order', { ascending: true });
        routeStops = stopsData || [];
      } catch (e) {
        console.warn('Error fetching delivery_route_stops:', e);
      }

      // Merge deliveries and routeStops
      const allDeliveriesByRoute: Record<string, any[]> = {};
      routeIds.forEach(id => {
        const fromDeliv = deliveries.filter(d => d.route_id === id);
        if (fromDeliv.length > 0) {
          allDeliveriesByRoute[id] = fromDeliv;
        } else {
          allDeliveriesByRoute[id] = routeStops.filter(s => s.route_id === id);
        }
      });

      // 3. Fetch orders
      const allOrderIds = Array.from(new Set([
        ...deliveries.map(d => d.order_id),
        ...routeStops.map(s => s.order_id),
      ])).filter(Boolean);

      const ordersMap = new Map<string, any>();
      const customersMap = new Map<string, any>();

      if (allOrderIds.length > 0) {
        try {
          const { data: ordersData } = await supabase
            .from('orders')
            .select('*')
            .in('id', allOrderIds);
          (ordersData || []).forEach(o => ordersMap.set(o.id, o));

          const customerIds = Array.from(new Set(
            (ordersData || []).map(o => o.cliente_id || o.customer_id).filter(Boolean)
          ));

          if (customerIds.length > 0) {
            const { data: custData } = await supabase
              .from('customers')
              .select('*')
              .in('id', customerIds);
            (custData || []).forEach(c => customersMap.set(c.id, c));
          }
        } catch (e) {
          console.warn('Error hydrating orders/customers for deliveries:', e);
        }
      }

      // 4. Fetch delivery events
      let events: any[] = [];
      try {
        const { data: eventData } = await supabase
          .from('delivery_events')
          .select('*')
          .in('route_id', routeIds);
        events = eventData || [];
      } catch (e) {
        console.warn('Error fetching delivery_events:', e);
      }

      return routes.map(r => {
        const rDeliveries = allDeliveriesByRoute[r.id] || [];
        const rEvents = events.filter(e => e.route_id === r.id);
        return mapRoute(r, rDeliveries, rEvents, ordersMap, customersMap);
      });
    } catch (err) {
      console.error('Fatal in deliveryService.getAll:', err);
      return [];
    }
  },

  getById: async (id: string): Promise<DeliveryRoute | undefined> => {
    try {
      const { data: r, error: routeErr } = await supabase
        .from('delivery_routes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (routeErr || !r) return undefined;

      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('*')
        .eq('route_id', id)
        .order('secuencia', { ascending: true });

      const { data: stops } = await supabase
        .from('delivery_route_stops')
        .select('*')
        .eq('route_id', id)
        .order('stop_order', { ascending: true });

      const effectiveDeliveries = (deliveries && deliveries.length > 0) ? deliveries : (stops || []);

      const orderIds = effectiveDeliveries.map(d => d.order_id).filter(Boolean);
      const ordersMap = new Map<string, any>();
      const customersMap = new Map<string, any>();

      if (orderIds.length > 0) {
        const { data: ordersData } = await supabase.from('orders').select('*').in('id', orderIds);
        (ordersData || []).forEach(o => ordersMap.set(o.id, o));
        const custIds = (ordersData || []).map(o => o.cliente_id).filter(Boolean);
        if (custIds.length > 0) {
          const { data: custData } = await supabase.from('customers').select('*').in('id', custIds);
          (custData || []).forEach(c => customersMap.set(c.id, c));
        }
      }

      const { data: events } = await supabase
        .from('delivery_events')
        .select('*')
        .eq('route_id', id);

      return mapRoute(r, effectiveDeliveries, events || [], ordersMap, customersMap);
    } catch (e) {
      console.error('Error in deliveryService.getById:', e);
      return undefined;
    }
  },

  getByDelivererId: async (delivererId: string): Promise<DeliveryRoute[]> => {
    const all = await deliveryService.getAll();
    return all.filter(r => r.repartidorId === delivererId);
  },

  updateStatus: async (id: string, status: DeliveryStatus, obs?: string): Promise<DeliveryRoute> => {
    const { error } = await supabase
      .from('delivery_routes')
      .update({
        estado: status,
        status: status === 'entregado' ? 'completed' : status === 'en_camino' ? 'active' : 'optimized',
        observaciones: obs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.warn('Error updating route status in Supabase:', error);
    }
    
    const routeInfo = await deliveryService.getById(id);
    if (!routeInfo) throw new Error('Ruta no encontrada tras actualizar');
    return routeInfo;
  },

  updateStop: async (
    deliveryId: string,
    clienteId: string,
    completado: boolean,
    horaReal?: string,
    motivoNoEntrega?: string,
    receptorNombre?: string,
    observaciones?: string,
    userMail?: string
  ): Promise<DeliveryRoute> => {
    // 1. Registrar evento de entrega en Supabase
    try {
      await supabase
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
    } catch (e) {
      console.warn('Error logging delivery event:', e);
    }

    // 2. Buscar qué orden de la ruta corresponde a este cliente y actualizar su estado
    try {
      const { data: deliveries } = await supabase
        .from('deliveries')
        .select('order_id, orders(id, cliente_id)')
        .eq('route_id', deliveryId);

      const targetDelivery = (deliveries || []).find(d => d.orders && (d.orders as any).cliente_id === clienteId);
      if (targetDelivery && targetDelivery.order_id) {
        const orderId = targetDelivery.order_id;
        const nextOrderStatus = completado 
          ? 'entregado' 
          : (motivoNoEntrega === 'Reprogramado' ? 'reprogramado' : 'pendiente_de_entrega');

        await supabase
          .from('orders')
          .update({
            estado: nextOrderStatus,
            observaciones: observaciones,
            payment_status: completado ? 'pagado' : undefined,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId);

        if (completado) {
          await supabase
            .from('receipts')
            .insert({
              order_id: orderId,
              numero_remito: `REM-${orderId.slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`,
              receptor_nombre: receptorNombre || 'Cliente o Vecino',
            });
        }
      }
    } catch (e) {
      console.warn('Error updating order for stop:', e);
    }

    // 3. Evaluar si todas las paradas de la ruta fueron procesadas
    const fullRoute = await deliveryService.getById(deliveryId);
    if (!fullRoute) throw new Error('Ruta no encontrada');

    const allStopsProcessed = fullRoute.stops.every(s => s.completado || s.motivoNoEntrega);
    if (allStopsProcessed) {
      await supabase
        .from('delivery_routes')
        .update({ estado: 'entregado', status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', deliveryId);
      fullRoute.estado = 'entregado';
    }

    return fullRoute;
  },

  create: async (route: Omit<DeliveryRoute, 'id'>): Promise<DeliveryRoute> => {
    const routeId = `deliv-${Date.now()}`;
    const now = new Date().toISOString();

    // 1. Insert header
    const { data: insertedRoute, error: routeErr } = await supabase
      .from('delivery_routes')
      .insert({
        id: routeId,
        branch_id: route.branchId ? (isNaN(Number(route.branchId)) ? 1 : Number(route.branchId)) : 1,
        repartidor_id: route.repartidorId,
        driver_id: route.repartidorId,
        fecha: route.fecha,
        date: route.fecha,
        estado: route.estado || 'armado',
        status: 'optimized',
        horario_estimado: route.horarioEstimado,
        observaciones: route.observaciones,
        planned_by: route.plannedBy,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();

    if (routeErr) {
      console.error('Error inserting delivery_route:', routeErr);
      throw routeErr;
    }

    // 2. Insert into deliveries table
    const dbDeliveries = route.stops.map((stop, index) => {
      const orderId = route.pedidosIds[index] || '';
      return {
        route_id: routeId,
        order_id: orderId,
        estado: 'pendiente',
        secuencia: index + 1,
      };
    });

    try {
      await supabase.from('deliveries').insert(dbDeliveries);
    } catch (e) {
      console.warn('Error inserting deliveries:', e);
    }

    // 3. Insert into delivery_route_stops
    const dbStops = route.stops.map((stop, index) => {
      const orderId = route.pedidosIds[index] || '';
      return {
        route_id: routeId,
        order_id: orderId,
        stop_order: index + 1,
        status: 'pendiente',
        created_at: now,
      };
    });

    try {
      await supabase.from('delivery_route_stops').insert(dbStops);
    } catch (e) {
      console.warn('Error inserting delivery_route_stops:', e);
    }

    // 4. Update orders assigned to this route
    for (const orderId of route.pedidosIds) {
      try {
        await supabase
          .from('orders')
          .update({
            estado: 'listo_para_reparto',
            repartidor_id: route.repartidorId,
            delivery_route_id: routeId,
            updated_at: now,
          })
          .eq('id', orderId);
      } catch (e) {
        console.warn('Error updating order status:', e);
      }
    }

    const createdRoute = await deliveryService.getById(routeId);
    if (!createdRoute) {
      return {
        id: routeId,
        branchId: route.branchId || 1,
        repartidorId: route.repartidorId,
        fecha: route.fecha,
        estado: route.estado || 'armado',
        horarioEstimado: route.horarioEstimado,
        pedidosIds: route.pedidosIds,
        stops: route.stops,
        observaciones: route.observaciones,
      };
    }
    return createdRoute;
  },
};
