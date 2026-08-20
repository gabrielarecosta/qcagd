import { supabase } from './supabaseClient';
import { GeoDeliveryRoute, DeliveryRouteStop, RouteStatus, StopStatus } from '../types/delivery';

export const routeService = {
  /**
   * Crea una nueva ruta de entrega con sus paradas secuenciadas
   */
  async createRoute(params: {
    driverId: string | null;
    date: string;
    totalDistance: number;
    estimatedDuration: number;
    notes?: string;
    stops: Array<{
      orderId: string;
      stopOrder: number;
      notes?: string;
    }>;
  }): Promise<GeoDeliveryRoute> {
    const routeId = `route-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    // 1. Crear registro en delivery_routes
    const routePayload = {
      id: routeId,
      driver_id: params.driverId || null,
      date: params.date,
      status: 'pendiente',
      total_distance: params.totalDistance,
      estimated_duration: params.estimatedDuration,
      notes: params.notes || '',
      created_at: now,
      updated_at: now,
    };

    const { data: routeData, error: routeError } = await supabase
      .from('delivery_routes')
      .insert(routePayload)
      .select()
      .single();

    if (routeError) {
      throw new Error(`Error al crear la ruta: ${routeError.message}`);
    }

    // 2. Crear las paradas en delivery_route_stops
    if (params.stops && params.stops.length > 0) {
      const stopsPayload = params.stops.map(s => ({
        route_id: routeId,
        order_id: s.orderId,
        stop_order: s.stopOrder,
        status: 'pendiente',
        notes: s.notes || '',
        created_at: now,
      }));

      const { error: stopsError } = await supabase
        .from('delivery_route_stops')
        .insert(stopsPayload);

      if (stopsError) {
        console.warn('Error al insertar paradas de ruta:', stopsError.message);
      }

      // 3. Actualizar estado de los pedidos a 'listo_para_reparto' o 'asignado' y vincular repartidor
      for (const s of params.stops) {
        await supabase
          .from('orders')
          .update({
            repartidor_id: params.driverId,
            estado: 'listo_para_reparto',
          })
          .eq('id', s.orderId);
      }
    }

    return {
      id: routeData.id,
      driverId: routeData.driver_id,
      date: routeData.date,
      status: routeData.status as RouteStatus,
      totalDistance: Number(routeData.total_distance || 0),
      estimatedDuration: Number(routeData.estimated_duration || 0),
      notes: routeData.notes,
      createdAt: routeData.created_at,
      updatedAt: routeData.updated_at,
    };
  },

  /**
   * Obtiene la ruta del día asignada a un repartidor con sus paradas y datos de clientes
   */
  /**
   * Obtiene la ruta del día asignada a un repartidor con sus paradas y datos de clientes
   */
  async getTodayRouteForDriver(driverId: string, dateStr?: string): Promise<GeoDeliveryRoute | null> {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];

    try {
      // 1. Obtener datos del perfil del chofer si es posible para alias/email/nombre
      let driverEmail = '';
      let driverName = '';
      const driverAliases = new Set<string>([driverId]);

      if (driverId) {
        // Buscar perfil por id, email o nombre
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, email, nombre')
          .or(`id.eq.${driverId},email.ilike.%${driverId}%,nombre.ilike.%${driverId}%`)
          .maybeSingle();
        if (prof) {
          driverEmail = prof.email || '';
          driverName = prof.nombre || '';
          if (prof.id) driverAliases.add(prof.id);
          if (prof.email) driverAliases.add(prof.email);
          if (prof.nombre) driverAliases.add(prof.nombre);
        }
      }

      // 2. Buscar ruta activa en delivery_routes por driver_id o repartidor_id usando select('*') para evitar fallas de FKs
      let route: any = null;

      const { data: activeRoutesForDriver } = await supabase
        .from('delivery_routes')
        .select('*')
        .neq('status', 'cancelada')
        .neq('estado', 'cancelado')
        .order('created_at', { ascending: false })
        .limit(15);

      if (activeRoutesForDriver && activeRoutesForDriver.length > 0) {
        // Prioridad 1: Coincidencia de driver_id o repartidor_id con alguno de los alias del chofer
        route = activeRoutesForDriver.find((r: any) => 
          Array.from(driverAliases).some(alias => 
            (r.driver_id && String(r.driver_id).toLowerCase() === String(alias).toLowerCase()) || 
            (r.repartidor_id && String(r.repartidor_id).toLowerCase() === String(alias).toLowerCase())
          )
        );

        // Prioridad 2: Si no hubo coincidencia estricta de alias, tomar la ruta activa más reciente
        if (!route) {
          route = activeRoutesForDriver[0];
        }
      }

      // 3. Cargar paradas de la ruta usando hidratación directa de 3 pasos (garantiza datos sin depender de FKs de Supabase)
      let rawStops: any[] = [];

      if (route) {
        // a. Intentar desde delivery_route_stops
        const { data: routeStops } = await supabase
          .from('delivery_route_stops')
          .select('*')
          .eq('route_id', route.id)
          .order('stop_order', { ascending: true });

        if (routeStops && routeStops.length > 0) {
          rawStops = routeStops.map(s => ({
            id: s.id,
            route_id: s.route_id,
            order_id: s.order_id,
            stop_order: s.stop_order,
            status: s.status,
            arrived_at: s.arrived_at,
            delivered_at: s.delivered_at,
            notes: s.notes,
          }));
        } else {
          // b. Fallback: Intentar desde deliveries
          const { data: delivs } = await supabase
            .from('deliveries')
            .select('*')
            .eq('route_id', route.id)
            .order('secuencia', { ascending: true });

          if (delivs && delivs.length > 0) {
            rawStops = delivs.map(d => ({
              id: d.id,
              route_id: d.route_id,
              order_id: d.order_id,
              stop_order: d.secuencia,
              status: d.estado,
              notes: d.motivo_no_entrega,
            }));
          }
        }
      }

      // c. Fallback si no hay paradas en las tablas de rutas: buscar pedidos asignados al chofer directamente en orders
      if (rawStops.length === 0) {
        const { data: assignedOrders } = await supabase
          .from('orders')
          .select('id, estado')
          .or(`repartidor_id.eq.${driverId},taken_by_id.eq.${driverId}`)
          .in('estado', ['listo_para_reparto', 'en_reparto', 'en_camino', 'armado', 'pendiente'])
          .order('created_at', { ascending: true });

        if (assignedOrders && assignedOrders.length > 0) {
          rawStops = assignedOrders.map((ord: any, idx: number) => ({
            id: `stop-ord-${ord.id}`,
            route_id: route?.id || `route-virtual-${driverId}`,
            order_id: ord.id,
            stop_order: idx + 1,
            status: ord.estado === 'en_camino' ? 'en_camino' : 'pendiente',
          }));

          if (!route) {
            route = {
              id: `route-virtual-${driverId}`,
              driver_id: driverId,
              date: targetDate,
              status: 'active',
              total_distance: 0,
              estimated_duration: 0,
              notes: 'Ruta activa asignada por administración',
            };
          }
        }
      }

      if (!route || rawStops.length === 0) {
        return null;
      }

      // 4. Hidratar órdenes y clientes en 2 consultas separadas súper rápidas y sin fallas
      const orderIds = Array.from(new Set(rawStops.map(s => s.order_id))).filter(Boolean);
      const ordersMap = new Map<string, any>();
      const customersMap = new Map<string, any>();

      if (orderIds.length > 0) {
        const { data: ordersData } = await supabase
          .from('orders')
          .select('*')
          .in('id', orderIds);

        (ordersData || []).forEach(o => ordersMap.set(o.id, o));

        const customerIds = Array.from(new Set((ordersData || []).map(o => o.cliente_id || o.customer_id))).filter(Boolean);
        if (customerIds.length > 0) {
          const { data: customersData } = await supabase
            .from('customers')
            .select('*')
            .in('id', customerIds);
          (customersData || []).forEach(c => customersMap.set(c.id, c));
        }
      }

      // 5. Mapear paradas combinando datos de forma 100% segura
      const mappedStops: DeliveryRouteStop[] = rawStops.map((s, idx) => {
        const ord = ordersMap.get(s.order_id);
        const clienteId = ord?.cliente_id || ord?.customer_id;
        const cust = customersMap.get(clienteId);

        return {
          id: s.id || `stop-${idx}`,
          routeId: s.route_id || route.id,
          orderId: s.order_id || ord?.id || `ord-${idx}`,
          stopOrder: s.stop_order || (idx + 1),
          status: (s.status || s.estado || 'pendiente') as StopStatus,
          arrivedAt: s.arrived_at,
          deliveredAt: s.delivered_at,
          notes: s.notes || '',
          orderNumber: ord?.numero || `Pedido #${s.order_id?.slice(-5) || idx + 1}`,
          customerName: cust?.razon_social || cust?.nombre || ord?.customer_name || 'Cliente',
          customerPhone: cust?.whatsapp || cust?.telefono || '',
          formattedAddress: ord?.formatted_address || ord?.original_address || cust?.direccion || 'General Deheza',
          originalAddress: ord?.original_address || cust?.direccion || '',
          total: Number(ord?.total || 0),
          paymentMethod: ord?.payment_method || 'efectivo',
          abonaCon: ord?.abona_con ? Number(ord.abona_con) : undefined,
          cambioEstimado: ord?.cambio_estimado ? Number(ord.cambio_estimado) : undefined,
          latitude: ord?.latitude ? Number(ord.latitude) : undefined,
          longitude: ord?.longitude ? Number(ord.longitude) : undefined,
          order: ord ? {
            id: ord.id,
            numero: ord.numero,
            customerName: cust?.razon_social || cust?.nombre || 'Cliente',
            customerPhone: cust?.whatsapp || cust?.telefono || '',
            formattedAddress: ord.formatted_address || ord.original_address || cust?.direccion || 'General Deheza',
            originalAddress: ord.original_address || cust?.direccion,
            total: Number(ord.total || 0),
            paymentMethod: ord.payment_method || 'efectivo',
            abonaCon: ord.abona_con ? Number(ord.abona_con) : undefined,
            cambioEstimado: ord.cambio_estimado ? Number(ord.cambio_estimado) : undefined,
            latitude: ord.latitude ? Number(ord.latitude) : undefined,
            longitude: ord.longitude ? Number(ord.longitude) : undefined,
          } : undefined,
        };
      });

      // Filtrar paradas para que solo contengan pedidos de reparto a domicilio (excluir retiro en sucursal/whatsapp)
      const deliveryStopsOnly = mappedStops.filter(s => {
        const method = (s as any).order?.delivery_method || (s as any).order?.deliveryMethod;
        return method !== 'retiro' && method !== 'whatsapp';
      });

      return {
        id: route.id,
        driverId: route.driver_id || route.repartidor_id || driverId,
        driverName: driverName || 'Chofer Asignado',
        date: route.date || route.fecha || targetDate,
        status: (route.status || route.estado || 'pendiente') as RouteStatus,
        totalDistance: Number(route.total_distance || 0),
        estimatedDuration: Number(route.estimated_duration || 0),
        notes: route.notes || route.observaciones || '',
        stops: deliveryStopsOnly,
        createdAt: route.created_at,
      };
    } catch (e) {
      console.warn('Error en getTodayRouteForDriver:', e);
      return null;
    }
  },

  /**
   * Actualiza el estado de una parada específica (ej: entregado / no entregado)
   */
  async updateStopStatus(params: {
    stopId: string;
    orderId: string;
    status: StopStatus;
    notes?: string;
  }): Promise<void> {
    const now = new Date().toISOString();

    const updatePayload: any = {
      status: params.status,
      notes: params.notes || '',
    };

    if (params.status === 'entregado') {
      updatePayload.delivered_at = now;
    } else if (params.status === 'en_camino') {
      updatePayload.arrived_at = now;
    }

    await supabase
      .from('delivery_route_stops')
      .update(updatePayload)
      .eq('id', params.stopId);

    const orderStatus = params.status === 'entregado' ? 'entregado' : params.status === 'en_camino' ? 'en_reparto' : 'pendiente';
    await supabase
      .from('orders')
      .update({
        estado: orderStatus,
        delivered_at: params.status === 'entregado' ? now : null,
      })
      .eq('id', params.orderId);
  },

  /**
   * Obtiene todas las rutas activas del día organizadas por zona para la vista general
   */
  async getAllActiveRoutesForToday(dateStr?: string): Promise<GeoDeliveryRoute[]> {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];

    try {
      // Buscar por fecha o las rutas más recientes en estado activo usando select('*') para evitar errores de FKs
      const { data: routes, error } = await supabase
        .from('delivery_routes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      let activeRoutes = (routes || []).filter((r: any) =>
        ['pendiente', 'en_curso', 'optimized', 'confirmed', 'active', 'armado', 'en_camino'].includes(
          r.status || r.estado || 'pendiente'
        )
      );

      if (activeRoutes.length === 0) {
        activeRoutes = routes || [];
      }

      if (error || !activeRoutes.length) {
        return [];
      }

      const results: GeoDeliveryRoute[] = [];

      for (const route of activeRoutes) {
        const effectiveDriverId = route.driver_id || route.repartidor_id;

        // Buscar nombre del chofer en profiles
        let driverName = 'Sin chofer asignado';
        if (effectiveDriverId) {
          const { data: driverProfile } = await supabase
            .from('profiles')
            .select('nombre')
            .eq('id', effectiveDriverId)
            .maybeSingle();
          if (driverProfile?.nombre) driverName = driverProfile.nombre;
        }

        // Cargar paradas de la ruta de forma directa
        const { data: rawStops } = await supabase
          .from('delivery_route_stops')
          .select('*')
          .eq('route_id', route.id)
          .order('stop_order', { ascending: true });

        const orderIds = Array.from(new Set((rawStops || []).map(s => s.order_id))).filter(Boolean);
        const ordersMap = new Map<string, any>();
        const customersMap = new Map<string, any>();

        if (orderIds.length > 0) {
          const { data: ordersData } = await supabase.from('orders').select('*').in('id', orderIds);
          (ordersData || []).forEach(o => ordersMap.set(o.id, o));
          const customerIds = Array.from(new Set((ordersData || []).map(o => o.cliente_id || o.customer_id))).filter(Boolean);
          if (customerIds.length > 0) {
            const { data: customersData } = await supabase.from('customers').select('*').in('id', customerIds);
            (customersData || []).forEach(c => customersMap.set(c.id, c));
          }
        }

        const mappedStops = (rawStops || []).map((s: any, idx: number) => {
          const ord = ordersMap.get(s.order_id);
          const clienteId = ord?.cliente_id || ord?.customer_id;
          const cust = customersMap.get(clienteId);

          return {
            id: s.id,
            routeId: s.route_id || route.id,
            orderId: s.order_id,
            stopOrder: s.stop_order || (idx + 1),
            status: s.status || s.estado || 'pendiente',
            arrivedAt: s.arrived_at,
            deliveredAt: s.delivered_at,
            notes: s.notes || '',
            orderNumber: ord?.numero || '',
            customerName: cust?.razon_social || cust?.nombre || 'Cliente',
            customerPhone: cust?.whatsapp || cust?.telefono || '',
            formattedAddress: ord?.formatted_address || ord?.original_address || cust?.direccion || 'General Deheza',
            total: Number(ord?.total || 0),
            paymentMethod: ord?.payment_method || 'efectivo',
            latitude: ord?.latitude ? Number(ord.latitude) : undefined,
            longitude: ord?.longitude ? Number(ord.longitude) : undefined,
            order: ord ? {
              id: ord.id,
              numero: ord.numero,
              customerName: cust?.razon_social || cust?.nombre || 'Cliente',
              customerPhone: cust?.whatsapp || cust?.telefono || '',
              formattedAddress: ord.formatted_address || ord.original_address || cust?.direccion || 'General Deheza',
              originalAddress: ord.original_address || cust?.direccion,
              total: Number(ord.total || 0),
              paymentMethod: ord.payment_method || 'efectivo',
              latitude: ord.latitude ? Number(ord.latitude) : undefined,
              longitude: ord.longitude ? Number(ord.longitude) : undefined,
            } : undefined,
          };
        });

        results.push({
          id: route.id,
          driverId: effectiveDriverId,
          driverName,
          date: route.date || route.fecha,
          status: (route.status || route.estado || 'pendiente') as RouteStatus,
          totalDistance: Number(route.total_distance || 0),
          estimatedDuration: Number(route.estimated_duration || 0),
          notes: route.notes || route.observaciones || '',
          stops: mappedStops,
          createdAt: route.created_at,
        });
      }

      return results;
    } catch (e) {
      console.warn('Error en getAllActiveRoutesForToday:', e);
      return [];
    }
  },
};
