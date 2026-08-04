import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAdminStore } from '../store/adminStore';
import { supabase } from '@shared/services/supabaseClient';
import { deliverySlotService, DeliverySlot } from '@shared/services/deliverySlotService';
import { formatPrice } from '@shared/utils/formatCurrency';
import { AddressLocationPicker } from '../components/AddressLocationPicker';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface OrderItemInfo {
  id: string;
  numero: string;
  fecha: string;
  total: number;
  estado: string;
  deliveryDate?: string;
  deliveryStartTime?: string;
  deliveryEndTime?: string;
  deliveryTimeSlotId?: string;
  deliveryMethod?: string;
  observacionesCliente?: string;
  latitude?: number;
  longitude?: number;
  locationVerified: boolean;
  addressReference?: string;
  priority: number;
  cliente: {
    id: string;
    nombre: string;
    razonSocial?: string;
    direccion: string;
    zona: string;
    telefono: string;
  };
}

interface DepotSettings {
  id: string;
  business_name: string;
  depot_address: string;
  depot_latitude: number;
  depot_longitude: number;
  service_radius_meters: number;
  default_departure_time: string;
  default_stop_duration_minutes: number;
  returns_to_depot: boolean;
  max_orders_per_route: number;
  city: string;
  province: string;
  country: string;
  phone: string;
}

export function LogisticsView() {
  const { users, activeBranchId, currentUser, fetchData, drivers } = useAdminStore();
  
  // State variables
  const [orders, setOrders] = useState<OrderItemInfo[]>([]);
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<DepotSettings>({
    id: 'config_delivery',
    business_name: 'Sodería General Deheza',
    depot_address: 'Bv. San Martín 123, General Deheza, Córdoba, Argentina',
    depot_latitude: -32.7566,
    depot_longitude: -63.7861,
    service_radius_meters: 8000,
    default_departure_time: '08:00',
    default_stop_duration_minutes: 10,
    returns_to_depot: true,
    max_orders_per_route: 20,
    city: 'General Deheza',
    province: 'Córdoba',
    country: 'Argentina',
    phone: '3584123456',
  });

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [correctingOrder, setCorrectingOrder] = useState<OrderItemInfo | null>(null);

  // Filters State
  const [filterDate, setFilterDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [filterSlotId, setFilterSlotId] = useState<string>('all');
  const [filterZone, setFilterZone] = useState<string>('all');
  const [searchAddress, setSearchAddress] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  // Selected orders for the planning route
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  
  // Ordered sequence of orders (route stops)
  const [routeStops, setRouteStops] = useState<OrderItemInfo[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<any | null>(null);
  
  // Metrics calculated from optimizer / router
  const [routeDistanceMeters, setRouteDistanceMeters] = useState(0);
  const [routeDurationSeconds, setRouteDurationSeconds] = useState(0);

  // Driver / Delivery Route Meta
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [routeNotes, setRouteNotes] = useState<string>('');

  // Drag and Drop active index
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Realtime alerts banner
  const [newOrderReceived, setNewOrderReceived] = useState(false);

  // Map reference
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const mapApiKey = import.meta.env.VITE_GEOAPIFY_MAP_KEY || '';
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';


  // Load depot settings
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('business_delivery_settings')
        .select('*')
        .eq('id', 'config_delivery')
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setSettings(data as DepotSettings);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  // Fetch delivery slots
  useEffect(() => {
    const loadSlots = async () => {
      try {
        const list = await deliverySlotService.getAll();
        setSlots(list.filter(s => s.activo));
      } catch (err) {
        console.error('Error loading slots:', err);
      }
    };
    loadSlots();
    fetchSettings();
  }, []);

  // Set default driver
  useEffect(() => {
    if (drivers.length > 0 && !selectedDriverId) {
      setSelectedDriverId(drivers[0].id);
    }
  }, [drivers, selectedDriverId]);

  // Fetch unassigned pending orders
  const fetchUnassignedOrders = async () => {
    setLoading(true);
    setNewOrderReceived(false);
    try {
      // Pedidos no asignados a ruta, no entregados, no cancelados
      let query = supabase
        .from('orders')
        .select(`
          id, numero, fecha, total, estado,
          delivery_date, delivery_start_time, delivery_end_time, delivery_time_slot_id, delivery_method, observaciones_cliente,
          latitude, longitude, location_verified, priority, address_reference,
          cliente:customers (id, nombre, razon_social, direccion, zona, telefono)
        `)
        .is('delivery_route_id', null)
        .is('deleted_at', null)
        .not('estado', 'eq', 'cancelado')
        .not('estado', 'eq', 'entregado');

      if (activeBranchId && activeBranchId !== 'all') {
        query = query.eq('branch_id', activeBranchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: OrderItemInfo[] = (data || []).map((o: any) => ({
        id: o.id,
        numero: o.numero,
        fecha: o.fecha,
        total: Number(o.total),
        estado: o.estado,
        deliveryDate: o.delivery_date,
        deliveryStartTime: o.delivery_start_time,
        deliveryEndTime: o.delivery_end_time,
        deliveryTimeSlotId: o.delivery_time_slot_id,
        deliveryMethod: o.delivery_method,
        observacionesCliente: o.observaciones_cliente,
        latitude: o.latitude,
        longitude: o.longitude,
        locationVerified: o.location_verified || false,
        priority: o.priority || 0,
        addressReference: o.address_reference,
        cliente: {
          id: o.cliente?.id || '',
          nombre: o.cliente?.nombre || 'Cliente Desconocido',
          razonSocial: o.cliente?.razon_social,
          direccion: o.cliente?.direccion || 'Sin dirección',
          zona: o.cliente?.zona || 'Centro',
          telefono: o.cliente?.telefono || '',
        }
      }));

      setOrders(mapped);

      // Load draft planning from localStorage if exists
      const savedDraftIds = localStorage.getItem('draft_route_order_ids');
      if (savedDraftIds) {
        const ids: string[] = JSON.parse(savedDraftIds);
        const matched = mapped.filter(o => ids.includes(o.id));
        setSelectedOrderIds(matched.map(o => o.id));
        // Keep order sequence
        const ordered = ids.map(id => matched.find(o => o.id === id)).filter(Boolean) as OrderItemInfo[];
        setRouteStops(ordered);
      }
    } catch (err) {
      console.error('Error fetching unassigned orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnassignedOrders();
  }, [activeBranchId]);

  // Supabase Realtime channel for order updates
  useEffect(() => {
    const channel = supabase
      .channel('realtime_orders_logistics')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        () => {
          setNewOrderReceived(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter unassigned orders list
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (filterDate && order.deliveryDate && order.deliveryDate !== filterDate) return false;
      if (filterSlotId !== 'all' && order.deliveryTimeSlotId !== filterSlotId) return false;
      if (filterZone !== 'all' && order.cliente.zona !== filterZone) return false;
      if (filterPriority !== 'all' && String(order.priority) !== filterPriority) return false;
      
      if (searchAddress.trim()) {
        const query = searchAddress.toLowerCase();
        const matchesAddress = order.cliente.direccion.toLowerCase().includes(query);
        const matchesName = order.cliente.nombre.toLowerCase().includes(query);
        const matchesNum = order.numero.toLowerCase().includes(query);
        if (!matchesAddress && !matchesName && !matchesNum) return false;
      }
      return true;
    });
  }, [orders, filterDate, filterSlotId, filterZone, searchAddress, filterPriority]);

  const availableZones = useMemo(() => {
    const zones = new Set<string>();
    orders.forEach(o => o.cliente.zona && zones.add(o.cliente.zona));
    return Array.from(zones);
  }, [orders]);

  // Handle checking / unchecking order for route inclusion
  const handleToggleSelectOrder = (orderId: string) => {
    const isSelected = selectedOrderIds.includes(orderId);
    let newSelected: string[];
    let newStops: OrderItemInfo[];

    if (isSelected) {
      newSelected = selectedOrderIds.filter(id => id !== orderId);
      newStops = routeStops.filter(o => o.id !== orderId);
    } else {
      const orderToInclude = orders.find(o => o.id === orderId);
      if (!orderToInclude) return;

      if (!orderToInclude.latitude || !orderToInclude.longitude) {
        alert('Este pedido no posee coordenadas geográficas válidas. Corregí la ubicación antes de sumarlo al reparto.');
        return;
      }

      newSelected = [...selectedOrderIds, orderId];
      newStops = [...routeStops, orderToInclude];
    }

    setSelectedOrderIds(newSelected);
    setRouteStops(newStops);
    localStorage.setItem('draft_route_order_ids', JSON.stringify(newSelected));

    // Reset geometry since stop list changed
    setRouteGeometry(null);
  };

  const handleSelectAll = () => {
    // Select all geolocated visible orders
    const geolocated = filteredOrders.filter(o => o.latitude && o.longitude);
    const ids = geolocated.map(o => o.id);
    setSelectedOrderIds(ids);
    setRouteStops(geolocated);
    localStorage.setItem('draft_route_order_ids', JSON.stringify(ids));
    setRouteGeometry(null);
  };

  const handleClearAll = () => {
    setSelectedOrderIds([]);
    setRouteStops([]);
    localStorage.removeItem('draft_route_order_ids');
    setRouteGeometry(null);
    setRouteDistanceMeters(0);
    setRouteDurationSeconds(0);
  };

  // Optimize route sequence using Geoapify Route Planner
  const handleOptimizeRoute = async () => {
    if (routeStops.length === 0) {
      alert('Seleccioná al menos un pedido geolocalizado en la lista.');
      return;
    }

    setOptimizing(true);
    try {
      const supabaseSessionKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
      const token = supabaseSessionKey ? JSON.parse(localStorage.getItem(supabaseSessionKey) || '{}').access_token : '';

      // 1. Llamar al optimizador del backend
      const response = await fetch(`${backendUrl}/api/routes/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          depot: {
            latitude: settings.depot_latitude,
            longitude: settings.depot_longitude,
          },
          orders: routeStops.map(o => ({
            id: o.id,
            latitude: o.latitude,
            longitude: o.longitude,
            priority: o.priority,
          })),
          returnsToDepot: settings.returns_to_depot,
          stopDurationMinutes: settings.default_stop_duration_minutes,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Error del optimizador');
      }

      const result = await response.json();

      // 2. Ordenar las paradas según la respuesta optimizada
      const optimizedOrderIds: string[] = result.stops.map((s: any) => s.orderId);
      const optimizedList = optimizedOrderIds
        .map(id => routeStops.find(o => o.id === id))
        .filter(Boolean) as OrderItemInfo[];

      setRouteStops(optimizedList);
      localStorage.setItem('draft_route_order_ids', JSON.stringify(optimizedOrderIds));

      // 3. Calcular la geometría completa llamando a la API de Routing
      const waypoints = [
        { latitude: settings.depot_latitude, longitude: settings.depot_longitude },
        ...optimizedList.map(o => ({ latitude: o.latitude!, longitude: o.longitude! })),
      ];
      if (settings.returns_to_depot) {
        waypoints.push({ latitude: settings.depot_latitude, longitude: settings.depot_longitude });
      }

      const routeResponse = await fetch(`${backendUrl}/api/routes/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ waypoints }),
      });

      if (routeResponse.ok) {
        const routeData = await routeResponse.json();
        setRouteGeometry(routeData.geojson);
        setRouteDistanceMeters(routeData.distance);
        setRouteDurationSeconds(routeData.time);
      }

    } catch (err: any) {
      console.error(err);
      alert('Error al optimizar recorrido: ' + err.message);
    } finally {
      setOptimizing(false);
    }
  };

  // Recalculate route geometry based on manual order reorder
  const handleRecalculateRoute = async (stopsList: OrderItemInfo[]) => {
    try {
      const supabaseSessionKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
      const token = supabaseSessionKey ? JSON.parse(localStorage.getItem(supabaseSessionKey) || '{}').access_token : '';

      const waypoints = [
        { latitude: settings.depot_latitude, longitude: settings.depot_longitude },
        ...stopsList.map(o => ({ latitude: o.latitude!, longitude: o.longitude! })),
      ];
      if (settings.returns_to_depot) {
        waypoints.push({ latitude: settings.depot_latitude, longitude: settings.depot_longitude });
      }

      const routeResponse = await fetch(`${backendUrl}/api/routes/recalculate-pending`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ waypoints }),
      });

      if (routeResponse.ok) {
        const routeData = await routeResponse.json();
        setRouteGeometry(routeData.geojson);
        setRouteDistanceMeters(routeData.distance);
        setRouteDurationSeconds(routeData.time);
      }
    } catch (err) {
      console.error('Error recalculating manual route:', err);
    }
  };

  // Confirm and persist route stops to Supabase
  const handleConfirmRoute = async () => {
    if (routeStops.length === 0) {
      alert('Armá el reparto antes de confirmar.');
      return;
    }
    if (!selectedDriverId) {
      alert('Asigná un repartidor a la hoja de ruta.');
      return;
    }

    setSaving(true);
    try {
      const routeId = `route-${Date.now()}`;
      const routeNumber = `HR-${String(Date.now()).slice(-6)}`;

      // 1. Crear registro principal de ruta
      const routePayload = {
        id: routeId,
        route_number: routeNumber,
        route_date: filterDate,
        status: 'confirmed',
        origin_address: settings.depot_address,
        origin_latitude: settings.depot_latitude,
        origin_longitude: settings.depot_longitude,
        returns_to_origin: settings.returns_to_depot,
        total_orders: routeStops.length,
        total_distance_meters: routeDistanceMeters,
        total_duration_seconds: routeDurationSeconds,
        route_geojson: routeGeometry,
        created_by: currentUser?.nombre || currentUser?.email || 'Admin',
        repartidor_id: selectedDriverId,
        fecha: filterDate,
        estado: 'armado',
        zona: filterZone === 'all' ? 'Multizona' : filterZone,
      };

      const { error: routeErr } = await supabase
        .from('delivery_routes')
        .insert(routePayload);

      if (routeErr) throw routeErr;

      // 2. Insertar paradas individuales
      const stopsPayload = routeStops.map((stop, index) => ({
        id: `stop-${stop.id}-${Date.now()}`,
        route_id: routeId,
        order_id: stop.id,
        stop_position: index + 1,
        latitude: stop.latitude!,
        longitude: stop.longitude!,
        status: 'pending',
      }));

      const { error: stopsErr } = await supabase
        .from('delivery_route_stops')
        .insert(stopsPayload);

      if (stopsErr) throw stopsErr;

      // 3. Vincular y asignar pedidos
      for (const stop of routeStops) {
        await supabase
          .from('orders')
          .update({
            delivery_route_id: routeId,
            repartidor_id: selectedDriverId,
            estado: 'asignado',
            delivery_status: 'pending',
          })
          .eq('id', stop.id);
      }

      alert('¡Hoja de ruta confirmada y enviada al móvil del repartidor!');
      
      // Reset layout state
      handleClearAll();
      fetchUnassignedOrders();
      fetchData();
    } catch (err: any) {
      console.error(err);
      alert('Error guardando reparto: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Toggle order priority
  const handleTogglePriority = async (orderId: string, currentPriority: number) => {
    const newPriority = currentPriority === 2 ? 0 : currentPriority + 1;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ priority: newPriority })
        .eq('id', orderId);
      if (error) throw error;

      // Update local state
      setOrders(orders.map(o => o.id === orderId ? { ...o, priority: newPriority } : o));
    } catch (err) {
      console.error('Error toggling priority:', err);
    }
  };

  // Save Depot configuration settings
  const handleSaveSettings = async (newSettings: DepotSettings) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('business_delivery_settings')
        .upsert(newSettings);
      if (error) throw error;

      setSettings(newSettings);
      setShowSettingsModal(false);
      alert('Configuración de reparto actualizada con éxito');
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  // Drag and Drop list ordering logic
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const listCopy = [...routeStops];
    const draggedItem = listCopy[draggedIndex];
    listCopy.splice(draggedIndex, 1);
    listCopy.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    setRouteStops(listCopy);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedIndex(null);
    const ids = routeStops.map(o => o.id);
    localStorage.setItem('draft_route_order_ids', JSON.stringify(ids));
    
    // Recalculate route geometries after drag and drop manually finishes
    handleRecalculateRoute(routeStops);
  };

  const handleMoveStop = (idx: number, dir: 'up' | 'down') => {
    const nextIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= routeStops.length) return;

    const listCopy = [...routeStops];
    const item = listCopy[idx];
    listCopy.splice(idx, 1);
    listCopy.splice(nextIdx, 0, item);

    setRouteStops(listCopy);
    localStorage.setItem('draft_route_order_ids', JSON.stringify(listCopy.map(o => o.id)));
    handleRecalculateRoute(listCopy);
  };

  // Render MapLibre routes and markers
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clear previous markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Initialize Map if not present
    if (!mapRef.current) {
      const styleUrl = `https://maps.geoapify.com/v1/styles/osm-carto/style.json?apiKey=${mapApiKey}`;
      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: styleUrl,
        center: [settings.depot_longitude, settings.depot_latitude],
        zoom: 13,
      });

      mapRef.current.on('load', () => {
        // Add source and layer for route geometries
        mapRef.current?.addSource('route-trazado', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        mapRef.current?.addLayer({
          id: 'route-linea',
          type: 'line',
          source: 'route-trazado',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#0ea5e9',
            'line-width': 5,
            'line-opacity': 0.85
          }
        });
      });
    }

    const map = mapRef.current;

    // 1. Add Depot Marker (Dark Blue)
    const depotEl = document.createElement('div');
    depotEl.style.width = '32px';
    depotEl.style.height = '32px';
    depotEl.style.borderRadius = '50%';
    depotEl.style.backgroundColor = '#0f172a';
    depotEl.style.border = '3px solid white';
    depotEl.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    depotEl.style.display = 'flex';
    depotEl.style.justifyContent = 'center';
    depotEl.style.alignItems = 'center';
    depotEl.style.color = 'white';
    depotEl.style.fontWeight = 'bold';
    depotEl.style.fontSize = '14px';
    depotEl.innerText = '🏠';

    const depotMarker = new maplibregl.Marker({ element: depotEl })
      .setLngLat([settings.depot_longitude, settings.depot_latitude])
      .setPopup(new maplibregl.Popup().setHTML(`<strong>Depósito Principal</strong><br/>${settings.depot_address}`))
      .addTo(map);

    markersRef.current.push(depotMarker);

    // 2. Add Stops / Orders Markers
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([settings.depot_longitude, settings.depot_latitude]);

    // Draw unselected active orders as grey dots
    const unselectedOrders = orders.filter(o => !selectedOrderIds.includes(o.id) && o.latitude && o.longitude);
    unselectedOrders.forEach(o => {
      const el = document.createElement('div');
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#94a3b8';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([o.longitude!, o.latitude!])
        .setPopup(new maplibregl.Popup().setHTML(`<strong>Pedido #${o.numero} (Disponible)</strong><br/>${o.cliente.nombre}<br/>${o.cliente.direccion}`))
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([o.longitude!, o.latitude!]);
    });

    // Draw planned stops as numbered badges
    routeStops.forEach((stop, idx) => {
      if (!stop.latitude || !stop.longitude) return;

      const el = document.createElement('div');
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#0ea5e9';
      el.style.border = '2px solid white';
      el.style.color = 'white';
      el.style.fontWeight = 'bold';
      el.style.fontSize = '12px';
      el.style.display = 'flex';
      el.style.justifyContent = 'center';
      el.style.alignItems = 'center';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.innerText = String(idx + 1);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([stop.longitude, stop.latitude])
        .setPopup(new maplibregl.Popup().setHTML(
          `<strong>Parada #${idx + 1} - Pedido #${stop.numero}</strong><br/>
           Cliente: ${stop.cliente.nombre}<br/>
           Dirección: ${stop.cliente.direccion}<br/>
           Monto: $${stop.total}`
        ))
        .addTo(map);

      markersRef.current.push(marker);
      bounds.extend([stop.longitude, stop.latitude]);
    });

    // Adjust map to fit bounds
    if (markersRef.current.length > 1) {
      map.fitBounds(bounds, { padding: 40, maxZoom: 16 });
    }

    // 3. Draw route geometry line if source is loaded
    if (map.getSource('route-trazado')) {
      const source = map.getSource('route-trazado') as maplibregl.GeoJSONSource;
      if (routeGeometry) {
        source.setData(routeGeometry);
      } else {
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    }

  }, [orders, routeStops, routeGeometry, settings]);

  // Export current delivery list to print
  const handlePrintSheet = () => {
    window.print();
  };

  return (
    <div className="view-container">
      {/* Realtime Alert Banner */}
      {newOrderReceived && (
        <div style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '12px 20px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
          <span>🔔 ¡Ingresó un nuevo pedido al sistema!</span>
          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={fetchUnassignedOrders}>
            Cargar Pedido
          </button>
        </div>
      )}

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Planificación y Optimización Logística</h1>
          <p className="page-desc">Registrá, geolocalizá y trazá recorridos sugeridos optimizados para General Deheza.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowSettingsModal(true)}>
          ⚙ Configuración de Reparto
        </button>
      </div>

      {/* Metric Cards Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Pedidos Pendientes</span>
          <h2 style={{ fontSize: '28px', margin: '4px 0 0 0', fontWeight: '800' }}>{orders.length}</h2>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center', backgroundColor: '#e0f2fe' }}>
          <span style={{ fontSize: '13px', color: '#0369a1' }}>Pedidos Seleccionados</span>
          <h2 style={{ fontSize: '28px', margin: '4px 0 0 0', color: '#0369a1', fontWeight: '800' }}>{routeStops.length}</h2>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Distancia Estimada</span>
          <h2 style={{ fontSize: '28px', margin: '4px 0 0 0', fontWeight: '800' }}>{(routeDistanceMeters / 1000).toFixed(1)} km</h2>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Duración Recorrido</span>
          <h2 style={{ fontSize: '28px', margin: '4px 0 0 0', fontWeight: '800' }}>{Math.round(routeDurationSeconds / 60)} min</h2>
        </div>
      </div>

      {/* Filters Form */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input type="date" className="form-input" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Franja</label>
            <select className="form-select" value={filterSlotId} onChange={e => setFilterSlotId(e.target.value)}>
              <option value="all">Todas las franjas</option>
              {slots.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Zona</label>
            <select className="form-select" value={filterZone} onChange={e => setFilterZone(e.target.value)}>
              <option value="all">Todas las zonas</option>
              {availableZones.map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Prioridad</label>
            <select className="form-select" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
              <option value="all">Todas</option>
              <option value="0">Normal</option>
              <option value="1">Alta</option>
              <option value="2">Urgente</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Buscar Dirección / Cliente</label>
            <input type="text" className="form-input" placeholder="Nombre, calle..." value={searchAddress} onChange={e => setSearchAddress(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Main Layout Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Side: Order selection list */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Pedidos Disponibles ({filteredOrders.length})</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={handleSelectAll}>
                Seleccionar Todos
              </button>
              <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={handleClearAll}>
                Limpiar Selección
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '600px', overflowY: 'auto', paddingRight: '4px' }}>
            {filteredOrders.map(o => {
              const isSelected = selectedOrderIds.includes(o.id);
              return (
                <div
                  key={o.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? 'var(--accent-light)' : 'white',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleSelectOrder(o.id)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold' }}>#{o.numero} - {o.cliente.nombre}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {o.priority === 2 && <span className="badge badge-error">Urgente</span>}
                        {o.priority === 1 && <span className="badge badge-warning">Alta</span>}
                        {o.latitude && o.longitude ? (
                          <span style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: 'bold' }}>📍 Geolocalizado</span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--error-color)', fontWeight: 'bold' }}>⚠️ Sin geolocalización</span>
                        )}
                      </div>
                    </div>

                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                      Dirección: {o.cliente.direccion} {o.addressReference ? `(${o.addressReference})` : ''}
                    </span>

                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-disabled)', marginTop: '6px' }}>
                      <span>Monto: <strong>${o.total.toLocaleString('es-AR')}</strong></span>
                      <span>Zona: {o.cliente.zona}</span>
                      {o.deliveryStartTime && (
                        <span>Franja: {o.deliveryStartTime} - {o.deliveryEndTime} hs</span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => setCorrectingOrder(o)}
                    >
                      📍 Geolocalizar
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => handleTogglePriority(o.id, o.priority)}
                    >
                      ⭐ Prioridad
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredOrders.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-disabled)' }}>
                No se encontraron pedidos pendientes para la combinación de filtros seleccionada.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Map & Optimized path */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Map view */}
          <div className="card" style={{ padding: '12px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>🗺 Mapa de Recorridos en General Deheza</h3>
            <div ref={mapContainerRef} style={{ height: '350px', width: '100%', borderRadius: '6px', overflow: 'hidden' }} />
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span>⬛ Depósito</span>
              <span>⬜ Pedidos Disponibles</span>
              <span>🟦 Paradas Seleccionadas</span>
            </div>
          </div>

          {/* Sequence planning section */}
          {routeStops.length > 0 && (
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>Paradas Planificadas ({routeStops.length})</h3>
                <button
                  className="btn btn-secondary"
                  disabled={optimizing}
                  onClick={handleOptimizeRoute}
                  style={{ backgroundColor: '#0ea5e9', color: 'white', border: 'none' }}
                >
                  {optimizing ? 'Optimizando...' : '⚡ Optimizar con Geoapify'}
                </button>
              </div>

              {/* Numbered drag and drop sequence */}
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                {routeStops.map((stop, idx) => (
                  <div
                    key={stop.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 10px',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                      cursor: 'grab',
                    }}
                  >
                    <span style={{ fontWeight: 'bold', color: '#0ea5e9' }}>#{idx + 1}</span>
                    <div style={{ flex: 1, fontSize: '13px' }}>
                      <span style={{ fontWeight: 'bold' }}>{stop.cliente.nombre}</span>
                      <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '11px' }}>{stop.cliente.direccion}</span>
                    </div>

                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '9px' }} disabled={idx === 0} onClick={() => handleMoveStop(idx, 'up')}>▲</button>
                      <button className="btn btn-secondary" style={{ padding: '2px 6px', fontSize: '9px' }} disabled={idx === routeStops.length - 1} onClick={() => handleMoveStop(idx, 'down')}>▼</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Confirm Route / Print Controls */}
              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '16px', paddingTop: '16px' }}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Chofer Repartidor</label>
                  <select className="form-select" value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.nombre}</option>
                    ))}
                    {drivers.length === 0 && (
                      <option value="">Sin repartidores registrados</option>
                    )}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Observaciones</label>
                  <input type="text" className="form-input" placeholder="Ej: Llevar bolsas de consorcio..." value={routeNotes} onChange={e => setRouteNotes(e.target.value)} />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={saving} onClick={handleConfirmRoute}>
                    {saving ? 'Guardando...' : '✔ Confirmar y Enviar'}
                  </button>
                  <button className="btn btn-secondary" onClick={handlePrintSheet}>
                    🖨 Imprimir Hoja
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* 1. Modal Configuración Depósito */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
          <div className="card" style={{ width: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <h2 style={{ marginTop: 0 }}>Configuración de Reparto</h2>
            
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Nombre del Negocio / Depósito</label>
              <input type="text" className="form-input" value={settings.business_name} onChange={e => setSettings({ ...settings, business_name: e.target.value })} />
            </div>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label className="form-label">Ubicación del Depósito</label>
              <AddressLocationPicker
                initialAddress={{
                  formattedAddress: settings.depot_address,
                  latitude: settings.depot_latitude,
                  longitude: settings.depot_longitude,
                }}
                onAddressSelect={(addr) => {
                  setSettings({
                    ...settings,
                    depot_address: addr.formattedAddress,
                    depot_latitude: addr.latitude,
                    depot_longitude: addr.longitude,
                  });
                }}
                depotLatitude={settings.depot_latitude}
                depotLongitude={settings.depot_longitude}
                serviceRadiusMeters={50000} // Radius ignored for setting depot itself
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group">
                <label className="form-label">Radio de Cobertura (m)</label>
                <input type="number" className="form-input" value={settings.service_radius_meters} onChange={e => setSettings({ ...settings, service_radius_meters: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">Salida Habitual</label>
                <input type="text" className="form-input" value={settings.default_departure_time} onChange={e => setSettings({ ...settings, default_departure_time: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div className="form-group">
                <label className="form-label">Minutos por Entrega</label>
                <input type="number" className="form-input" value={settings.default_stop_duration_minutes} onChange={e => setSettings({ ...settings, default_stop_duration_minutes: Number(e.target.value) })} />
              </div>
              <div className="form-group">
                <label className="form-label">Max Pedidos por Ruta</label>
                <input type="number" className="form-input" value={settings.max_orders_per_route} onChange={e => setSettings({ ...settings, max_orders_per_route: Number(e.target.value) })} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.returns_to_depot} onChange={e => setSettings({ ...settings, returns_to_depot: e.target.checked })} />
                <span>¿El vehículo regresa al depósito al finalizar?</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => handleSaveSettings(settings)}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal Geolocalizar Pedido Individual */}
      {correctingOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999 }}>
          <div className="card" style={{ width: '550px', padding: '24px' }}>
            <h2 style={{ marginTop: 0 }}>Geolocalizar Domicilio del Pedido</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Pedido: <strong>#{correctingOrder.numero}</strong><br/>
              Cliente: {correctingOrder.cliente.nombre}<br/>
              Dirección Original: {correctingOrder.cliente.direccion}
            </p>

            <AddressLocationPicker
              initialAddress={{
                formattedAddress: correctingOrder.cliente.direccion,
                latitude: correctingOrder.latitude,
                longitude: correctingOrder.longitude,
              }}
              depotLatitude={settings.depot_latitude}
              depotLongitude={settings.depot_longitude}
              serviceRadiusMeters={settings.service_radius_meters}
              onAddressSelect={async (addr, isManual) => {
                try {
                  const { error } = await supabase
                    .from('orders')
                    .update({
                      latitude: addr.latitude,
                      longitude: addr.longitude,
                      location_verified: true,
                      verification_method: isManual ? 'manual' : 'auto',
                      location_verified_at: new Date().toISOString(),
                    })
                    .eq('id', correctingOrder.id);

                  if (error) throw error;

                  // Update order local coordinates in the list
                  setOrders(orders.map(o => o.id === correctingOrder.id ? {
                    ...o,
                    latitude: addr.latitude,
                    longitude: addr.longitude,
                    locationVerified: true,
                  } : o));

                  // Update route stop coords if this order was already selected
                  setRouteStops(routeStops.map(s => s.id === correctingOrder.id ? {
                    ...s,
                    latitude: addr.latitude,
                    longitude: addr.longitude,
                    locationVerified: true,
                  } : s));

                } catch (err) {
                  console.error('Error saving geocoded address on orders:', err);
                }
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={() => setCorrectingOrder(null)}>Aceptar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
