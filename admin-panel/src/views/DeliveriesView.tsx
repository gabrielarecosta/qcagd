import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAdminStore } from '../store/adminStore';
import type { DeliveryRoute, DeliveryStop } from '@shared/types/delivery';
import { formatPrice } from '@shared/utils/formatCurrency';
import { optimizeRouteStops, geocodeAddress } from '@shared/utils/geo';
import { suggestDehezaStreets } from '@shared/utils/dehezaStreets';
import { routeService } from '@shared/services/routeService';
import * as XLSX from 'xlsx';
import { supabase } from '@shared/services/supabaseClient';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Punto de Inicio 1: SUCURSAL CENTRAL QGD (Por defecto)
const SUCURSAL_CENTRAL_QGD = {
  name: 'SUCURSAL CENTRAL QGD',
  address: 'Entre Ríos 151, General Deheza, Córdoba, Argentina',
  latitude: -32.7650,
  longitude: -63.7860,
};

export function DeliveriesView() {
  const { 
    deliveries, 
    orders, 
    clients, 
    branches, 
    users, 
    zones, 
    activeBranchId, 
    createDelivery, 
    updateDeliveryStatus,
    updateOrder,
    drivers,
    updateDriver,
    fetchData
  } = useAdminStore();

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isPlanning, setIsPlanning] = useState(false);
  const [isManagingDrivers, setIsManagingDrivers] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editingDriverName, setEditingDriverName] = useState('');
  const [editingDriverEmail, setEditingDriverEmail] = useState('');
  const [editingDriverVehicle, setEditingDriverVehicle] = useState('');
  const [editingDriverPhone, setEditingDriverPhone] = useState('');
  const [savingDriver, setSavingDriver] = useState(false);

  // Form State for planning new route
  const [formBranchId, setFormBranchId] = useState('branch-gd1');
  const [formDriverId, setFormDriverId] = useState('');
  const [formZona, setFormZona] = useState('all'); // 'all' = Todas las zonas
  const [formTurno, setFormTurno] = useState('all'); // 'all' = Todos los rangos horarios

  // ── PUNTO DE INICIO (SUCURSAL CENTRAL O GALPÓN/DEPÓSITO) ──
  const [startPointType, setStartPointType] = useState<'sucursal_central' | 'galpon_deposito'>('sucursal_central');
  const [customGalponAddress, setCustomGalponAddress] = useState('Ruta Nacional 158 km 220, General Deheza');
  const [startPointCoords, setStartPointCoords] = useState<{ latitude: number; longitude: number; name: string; address: string }>(SUCURSAL_CENTRAL_QGD);
  const [calculatingGalpon, setCalculatingGalpon] = useState(false);

  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [optimizedPlan, setOptimizedPlan] = useState<any | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Referencias para el mapa del modal
  const mapModalContainerRef = useRef<HTMLDivElement>(null);
  const mapModalInstanceRef = useRef<maplibregl.Map | null>(null);
  const modalMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Set default driver on open planning modal
  const handleOpenPlanning = () => {
    setIsPlanning(true);
    const firstBranch = activeBranchId !== 'all' ? activeBranchId : (branches[0]?.id || 'branch-gd1');
    setFormBranchId(firstBranch);
    const branchDrivers = drivers.filter(d => d.branchId === firstBranch);
    setFormDriverId(branchDrivers[0]?.id || drivers[0]?.id || '');
    setFormZona('all'); // Por defecto 'TODAS' para agrupar todo si hay 1 solo repartidor
    setFormTurno('all'); // Por defecto 'TODOS'
    setStartPointType('sucursal_central');
    setStartPointCoords(SUCURSAL_CENTRAL_QGD);
    setSelectedOrderIds([]);
    setOptimizedPlan(null);
  };

  // Manejar cambio en el punto de inicio
  const handleSelectStartPointType = async (type: 'sucursal_central' | 'galpon_deposito') => {
    setStartPointType(type);
    if (type === 'sucursal_central') {
      setStartPointCoords(SUCURSAL_CENTRAL_QGD);
    } else {
      await handleGeocodeCustomGalpon(customGalponAddress);
    }
  };

  // Geocodificar dirección personalizada del Galpón / Depósito
  const handleGeocodeCustomGalpon = async (addressText: string) => {
    if (!addressText.trim()) return;
    setCalculatingGalpon(true);
    try {
      const geo = await geocodeAddress(addressText, 'General Deheza', 'Córdoba');
      if (geo) {
        setStartPointCoords({
          name: 'GALPÓN / DEPÓSITO',
          address: geo.formattedAddress || addressText,
          latitude: geo.latitude,
          longitude: geo.longitude,
        });
      } else {
        setStartPointCoords({
          name: 'GALPÓN / DEPÓSITO',
          address: `${addressText}, General Deheza`,
          latitude: -32.7566,
          longitude: -63.7861,
        });
      }
    } catch (e) {
      console.warn('Error geocoding custom galpon:', e);
      setStartPointCoords({
        name: 'GALPÓN / DEPÓSITO',
        address: `${addressText}, General Deheza`,
        latitude: -32.7566,
        longitude: -63.7861,
      });
    } finally {
      setCalculatingGalpon(false);
    }
  };

  // Orders eligible for delivery route (not yet assigned, associated with branch, and ready/received)
  const allEligibleOrders = useMemo(() => {
    const assignedOrderIds = new Set(deliveries.flatMap(d => d.pedidosIds || []));
    
    return orders.filter(o => {
      const matchesBranch = o.branchId === formBranchId;
      const isNotAssigned = !assignedOrderIds.has(o.id);
      const isCorrectStatus = o.estado === 'recibido' || o.estado === 'en_preparacion' || o.estado === 'listo_para_reparto';
      const isReparto = o.deliveryMethod !== 'retiro' && o.deliveryMethod !== 'whatsapp';
      
      return matchesBranch && isNotAssigned && isCorrectStatus && isReparto;
    });
  }, [orders, deliveries, formBranchId]);

  // Pedidos elegibles filtrados según la zona y el rango horario seleccionados
  const filteredEligibleOrders = useMemo(() => {
    return allEligibleOrders.filter(o => {
      // 1. Filtro por Zona
      if (formZona !== 'all') {
        const client = clients.find(c => c.id === o.clienteId);
        const orderZoneId = o.zoneId;
        const matchedZone = zones.find(z => z.id === orderZoneId || z.nombre === formZona || z.name === formZona);
        const clientZone = client?.zona || '';

        const matchesZone = (matchedZone && (matchedZone.nombre === formZona || matchedZone.name === formZona || matchedZone.id === formZona)) ||
                            clientZone.toLowerCase().includes(formZona.toLowerCase());

        if (!matchesZone) return false;
      }

      // 2. Filtro por Turno / Rango Horario
      if (formTurno !== 'all') {
        const shift = (o as any).estimatedDeliveryShift || (o as any).deliveryTimeSlotId || (o as any).turno || (o as any).horarioEstimado || '';
        if (shift) {
          if (formTurno.includes('Mañana') && !shift.toLowerCase().includes('mañana') && !shift.toLowerCase().includes('08:00')) return false;
          if (formTurno.includes('Mediodía') && !shift.toLowerCase().includes('mediodía') && !shift.toLowerCase().includes('12:00')) return false;
          if (formTurno.includes('Tarde') && !shift.toLowerCase().includes('tarde') && !shift.toLowerCase().includes('16:00')) return false;
        }
      }

      return true;
    });
  }, [allEligibleOrders, formZona, formTurno, clients, zones]);

  // Recalcular trayecto por coordenadas automáticamente cada vez que cambian las órdenes o el punto de inicio
  useEffect(() => {
    if (!isPlanning) return;

    const runOptimization = async () => {
      if (selectedOrderIds.length === 0) {
        setOptimizedPlan(null);
        return;
      }

      setIsGeocoding(true);
      const stopsToOptimize: any[] = [];

      for (const orderId of selectedOrderIds) {
        const order = orders.find(o => o.id === orderId);
        if (!order) continue;

        const client = clients.find(c => c.id === order.clienteId);
        let lat = order.latitude || (client as any)?.latitude;
        let lng = order.longitude || (client as any)?.longitude;

        // Si no tiene coordenadas válidas, geocodificar por dirección automáticamente
        if (!lat || !lng) {
          const address = order.formattedAddress || order.originalAddress || client?.direccion || '';
          try {
            const geo = await geocodeAddress(address, 'General Deheza', 'Córdoba');
            if (geo) {
              lat = geo.latitude;
              lng = geo.longitude;
            } else {
              const dehezaSug = suggestDehezaStreets(address, 1);
              if (dehezaSug.length > 0) {
                lat = dehezaSug[0].latitude;
                lng = dehezaSug[0].longitude;
              } else {
                lat = -32.7561;
                lng = -63.7845;
              }
            }
            // Actualizar coordenadas en segundo plano
            await supabase.from('orders').update({ latitude: lat, longitude: lng, location_verified: true }).eq('id', order.id);
            order.latitude = lat;
            order.longitude = lng;
          } catch (e) {
            lat = -32.7561;
            lng = -63.7845;
          }
        }


        const client = clients.find(c => c.id === order.clienteId);
        stopsToOptimize.push({
          orderId: order.id,
          latitude: lat,
          longitude: lng,
          numero: order.numero,
          customerName: client?.razonSocial || client?.nombre || order.customerName || 'Cliente',
          formattedAddress: order.formattedAddress || order.originalAddress || client?.direccion || 'Sin dirección',
          total: order.total,
        });
      }

      setIsGeocoding(false);

      if (stopsToOptimize.length > 0) {
        // Optimizar recorrido iniciando desde el punto seleccionado (Sucursal Central o Galpón/Depósito)
        const result = optimizeRouteStops(startPointCoords, stopsToOptimize, 8, 30);
        setOptimizedPlan(result);
      }
    };

    runOptimization();
  }, [selectedOrderIds, startPointCoords, isPlanning]);

  // Renderizar mapa interactivo del modal de planificación
  useEffect(() => {
    if (!isPlanning || !mapModalContainerRef.current) return;

    if (!mapModalInstanceRef.current) {
      const map = new maplibregl.Map({
        container: mapModalContainerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors | Química General Deheza',
            },
          },
          layers: [
            {
              id: 'osm-tiles',
              type: 'raster',
              source: 'osm',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: [startPointCoords.longitude, startPointCoords.latitude],
        zoom: 13.8,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      mapModalInstanceRef.current = map;
    }

    const map = mapModalInstanceRef.current;

    const updateMapElements = () => {
      // Limpiar marcadores previos
      modalMarkersRef.current.forEach(m => m.remove());
      modalMarkersRef.current = [];

      // Marcador del Punto de Inicio Seleccionado (Sucursal Central o Galpón)
      const startEl = document.createElement('div');
      const isCentral = startPointType === 'sucursal_central';
      startEl.innerHTML = `
        <div style="background: ${isCentral ? '#0f172a' : '#ea580c'}; color: white; padding: 4px 8px; border-radius: 12px; font-weight: bold; font-size: 11px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white; display: flex; align-items: center; gap: 4px;">
          ${isCentral ? '🏬 SUCURSAL CENTRAL QGD' : '🏭 GALPÓN / DEPÓSITO'}
        </div>
      `;
      const startMarker = new maplibregl.Marker({ element: startEl })
        .setLngLat([startPointCoords.longitude, startPointCoords.latitude])
        .addTo(map);
      modalMarkersRef.current.push(startMarker);

      if (optimizedPlan && optimizedPlan.orderedStops.length > 0) {
        // Marcadores de paradas ordenadas
        optimizedPlan.orderedStops.forEach((stop: any) => {
          const el = document.createElement('div');
          el.innerHTML = `
            <div style="background: #10b981; color: white; width: 26px; height: 26px; border-radius: 13px; font-weight: bold; font-size: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white;">
              #${stop.stopOrder}
            </div>
          `;

          const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
            <div style="padding: 4px; font-family: sans-serif;">
              <strong>Parada #${stop.stopOrder}</strong><br/>
              <span style="font-size: 12px; color: #0f172a;">${stop.customerName}</span><br/>
              <span style="font-size: 11px; color: #64748b;">${stop.formattedAddress}</span>
            </div>
          `);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([stop.longitude, stop.latitude])
            .setPopup(popup)
            .addTo(map);

          modalMarkersRef.current.push(marker);
        });

        // Trazar línea de recorrido / trayecto desde el punto de inicio
        const routeCoords = [
          [startPointCoords.longitude, startPointCoords.latitude],
          ...optimizedPlan.orderedStops.map((s: any) => [s.longitude, s.latitude]),
        ];

        const geojson: any = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeCoords,
              },
            },
          ],
        };

        if (map.getSource('modal-route-source')) {
          (map.getSource('modal-route-source') as any).setData(geojson);
        } else if (map.isStyleLoaded()) {
          map.addSource('modal-route-source', {
            type: 'geojson',
            data: geojson,
          });

          map.addLayer({
            id: 'modal-route-line',
            type: 'line',
            source: 'modal-route-source',
            paint: {
              'line-color': '#10b981',
              'line-width': 4,
              'line-opacity': 0.85,
            },
          });
        }

        // Ajustar vista a las coordenadas
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend([startPointCoords.longitude, startPointCoords.latitude]);
        optimizedPlan.orderedStops.forEach((s: any) => bounds.extend([s.longitude, s.latitude]));
        map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
      }
    };

    if (map.isStyleLoaded()) {
      updateMapElements();
    } else {
      map.on('load', updateMapElements);
    }
  }, [isPlanning, optimizedPlan, startPointCoords, startPointType]);

  // Filter deliveries list
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(d => {
      const globalBranchFilter = activeBranchId === 'all' || !d.branchId || d.branchId === activeBranchId;
      const matchesStatus = selectedStatus === 'all' || d.estado === selectedStatus;
      return globalBranchFilter && matchesStatus;
    });
  }, [deliveries, activeBranchId, selectedStatus]);

  const getDriverName = (driverId: string) => {
    const d = users.find(u => u.id === driverId) || drivers.find(dr => dr.id === driverId);
    return d ? d.nombre : 'Sin chofer';
  };

  const getBranchName = (bId: string) => {
    const b = branches.find(item => item.id === bId);
    return b ? b.nombre : 'Sin sucursal';
  };

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Botón para seleccionar y agrupar automáticamente todos los pedidos del filtro actual
  const handleSelectAllGroup = () => {
    const visibleIds = filteredEligibleOrders.map(o => o.id);
    const allSelected = visibleIds.every(id => selectedOrderIds.includes(id));

    if (allSelected) {
      // Desmarcar los de este grupo
      setSelectedOrderIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      // Marcar todos los de este grupo
      const combined = new Set([...selectedOrderIds, ...visibleIds]);
      setSelectedOrderIds(Array.from(combined));
    }
  };

  // 🖨️ IMPRIMIR HOJA DE RUTA CON ORDEN SECUENCIAL SEGÚN ORIGEN
  const handlePrintRoute = (deliveryOrPlan: any, isDraftPlan: boolean = false) => {
    let routeDate = new Date().toLocaleDateString('es-AR');
    let driverName = 'Sin chofer asignado';
    let zoneTitle = 'General Deheza';
    let shiftTitle = 'Jornada Completa';
    let startPointText = 'SUCURSAL CENTRAL QGD (Entre Ríos 151, General Deheza)';
    let totalKm = '0';
    let durationMin = '0';
    let stopsData: Array<{
      orderNumber: string;
      customerName: string;
      address: string;
      phone: string;
      amount: number;
      paymentMethod: string;
      changeNote: string;
      obs: string;
    }> = [];

    if (isDraftPlan && optimizedPlan) {
      driverName = getDriverName(formDriverId);
      zoneTitle = formZona === 'all' ? 'General Deheza (Todas las Zonas)' : formZona;
      shiftTitle = formTurno === 'all' ? 'Todos los Horarios (08:00 a 20:00)' : formTurno;
      startPointText = `${startPointCoords.name} (${startPointCoords.address})`;
      totalKm = String(optimizedPlan.totalDistanceKm || 0);
      durationMin = String(optimizedPlan.estimatedDurationMinutes || 0);

      stopsData = (optimizedPlan.orderedStops || []).map((s: any) => {
        const ord = orders.find(o => o.id === s.orderId);
        const cli = clients.find(c => c.id === ord?.clienteId);
        return {
          orderNumber: ord?.numero || s.numero || '-',
          customerName: cli?.razonSocial || cli?.nombre || ord?.customerName || s.customerName || 'Cliente',
          address: ord?.formattedAddress || ord?.originalAddress || cli?.direccion || s.formattedAddress || 'Sin dirección',
          phone: cli?.telefono || ord?.customerPhone || '',
          amount: Number(ord?.total || s.total || 0),
          paymentMethod: (ord?.paymentMethod || 'efectivo').toUpperCase(),
          changeNote: ord?.abonaCon ? `Paga $${ord.abonaCon} (Cambio: $${ord.cambioEstimado || 0})` : '',
          obs: ord?.observacionesCliente || ord?.addressReference || '',
        };
      });
    } else {
      const d = deliveryOrPlan;
      routeDate = d.fecha || routeDate;
      driverName = getDriverName(d.repartidorId || '');
      zoneTitle = d.zona || 'Zona General';
      shiftTitle = d.horarioEstimado || 'Turno Regular';
      startPointText = d.observaciones?.includes('Punto de inicio:') 
        ? d.observaciones.split('|')[0].replace('Punto de inicio:', '').trim()
        : 'SUCURSAL CENTRAL QGD (Entre Ríos 151, General Deheza)';
      
      const stopsList = d.stops || [];
      stopsData = stopsList.map((stop: any, idx: number) => {
        const orderId = (d.pedidosIds || [])[idx];
        const ord = orders.find(o => o.id === orderId);
        const cli = clients.find(c => c.id === ord?.clienteId);
        return {
          orderNumber: ord?.numero || `#${idx + 1}`,
          customerName: stop.clienteNombre || cli?.razonSocial || 'Cliente',
          address: stop.direccion || cli?.direccion || 'Sin dirección',
          phone: cli?.telefono || ord?.customerPhone || '',
          amount: Number(ord?.total || 0),
          paymentMethod: (ord?.paymentMethod || 'efectivo').toUpperCase(),
          changeNote: ord?.abonaCon ? `Paga $${ord.abonaCon} (Cambio: $${ord.cambioEstimado || 0})` : '',
          obs: ord?.observacionesCliente || ord?.addressReference || '',
        };
      });
    }

    const totalToCollect = stopsData.reduce((acc, s) => acc + s.amount, 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor habilita las ventanas emergentes en tu navegador para imprimir la hoja de ruta.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hoja de Ruta - ${zoneTitle} - Química General Deheza</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 portrait; margin: 12mm 14mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 0; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
          .company-title { font-size: 17px; font-weight: 800; color: #0f172a; margin: 0; }
          .doc-title { font-size: 13px; font-weight: 700; color: #0284c7; text-transform: uppercase; margin: 2px 0 0; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 11px; }
          .meta-item { margin-bottom: 3px; }
          .meta-item strong { color: #334155; }
          .origin-box { background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #0284c7; padding: 6px 10px; border-radius: 4px; margin-bottom: 12px; font-size: 11px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          th { background: #0f172a; color: white; text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; border: 1px solid #0f172a; }
          td { padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; vertical-align: top; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .stop-badge { display: inline-block; background: #10b981; color: white; font-weight: 800; font-size: 11px; padding: 2px 6px; border-radius: 12px; }
          .money { text-align: right; font-weight: 700; color: #0f172a; }
          .signature-box { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 25px; padding-top: 15px; }
          .signature-line { border-top: 1px dashed #64748b; text-align: center; padding-top: 5px; font-size: 11px; color: #475569; }
          .summary-card { display: flex; justify-content: space-between; align-items: center; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-bottom: 12px; }
          @media print {
            button { display: none !important; }
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="company-title">QUÍMICA GENERAL DEHEZA</h1>
            <div class="doc-title">📋 HOJA DE RUTA Y DESPACHO DE REPARTO</div>
          </div>
          <div style="text-align: right; font-size: 11px;">
            <div><strong>Fecha:</strong> ${routeDate}</div>
            <div><strong>Hora Impresión:</strong> ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        <div class="origin-box">
          🚩 <strong>PUNTO DE ORIGEN / SALIDA DEL REPARTO:</strong> ${startPointText}
        </div>

        <div class="meta-grid">
          <div>
            <div class="meta-item"><strong>Chofer / Repartidor:</strong> ${driverName}</div>
            <div class="meta-item"><strong>Zona de Reparto:</strong> ${zoneTitle}</div>
          </div>
          <div>
            <div class="meta-item"><strong>Turno / Horario:</strong> ${shiftTitle}</div>
            <div class="meta-item"><strong>Total Paradas:</strong> ${stopsData.length} entregas ${totalKm !== '0' ? `· (${totalKm} km estimados)` : ''}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 36px; text-align: center;">#</th>
              <th style="width: 70px;">Pedido</th>
              <th>Cliente / Razón Social</th>
              <th>Dirección de Entrega</th>
              <th style="width: 80px;">Teléfono</th>
              <th style="width: 75px;">Pago</th>
              <th style="width: 85px; text-align: right;">A Cobrar</th>
              <th style="width: 85px; text-align: center;">Firma / Recibió</th>
            </tr>
          </thead>
          <tbody>
            ${stopsData.map((s, idx) => `
              <tr>
                <td style="text-align: center;"><span class="stop-badge">#${idx + 1}</span></td>
                <td><strong>${s.orderNumber}</strong></td>
                <td><strong>${s.customerName}</strong></td>
                <td>
                  <strong>${s.address}</strong>
                  ${s.obs ? `<div style="font-size: 9.5px; color: #0284c7; font-style: italic;">Ref: ${s.obs}</div>` : ''}
                </td>
                <td>${s.phone || '-'}</td>
                <td>
                  ${s.paymentMethod}
                  ${s.changeNote ? `<div style="font-size: 9.5px; color: #ea580c; font-weight: bold;">${s.changeNote}</div>` : ''}
                </td>
                <td class="money">$${s.amount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                <td style="height: 28px; border-bottom: 1px solid #cbd5e1;"></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="summary-card">
          <span>TOTAL A COBRAR EN ESTE RECORRIDO (${stopsData.length} paradas):</span>
          <span>$${totalToCollect.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>

        <div class="signature-box">
          <div class="signature-line">
            Firma y Aclaración del Chofer<br/>
            <strong>${driverName}</strong>
          </div>
          <div class="signature-line">
            Firma y Sello de Despacho / Depósito<br/>
            <strong>Química General Deheza</strong>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDriverId || selectedOrderIds.length === 0) return;

    // Obtener paradas ordenadas por trayecto geográfico
    const orderedStops = optimizedPlan?.orderedStops || [];
    const sequencedOrderIds = orderedStops.length > 0
      ? orderedStops.map((s: any) => s.orderId)
      : selectedOrderIds;

    // Create stops from selected orders in optimal sequence
    const stops: DeliveryStop[] = sequencedOrderIds.map((oId: string) => {
      const order = orders.find(o => o.id === oId);
      const client = clients.find(c => c.id === order?.clienteId);
      return {
        clienteId: client?.id || '',
        clienteNombre: client?.razonSocial || client?.nombre || order?.customerName || 'Desconocido',
        direccion: order?.formattedAddress || order?.originalAddress || client?.direccion || 'Sin dirección',
        completado: false,
      };
    });

    const targetDate = new Date().toISOString().split('T')[0];
    const displayZoneName = formZona === 'all' ? 'General Deheza (Todas las Zonas)' : formZona;
    const displayTurnoName = formTurno === 'all' ? 'Todos los Horarios (08:00 a 20:00)' : formTurno;
    const startPointLabel = `${startPointCoords.name} (${startPointCoords.address})`;

    // 1. Guardar la hoja de ruta con todas sus paradas sincronizadas
    try {
      await createDelivery({
        branchId: formBranchId || activeBranchId !== 'all' ? formBranchId : 'branch-gd1',
        repartidorId: formDriverId,
        fecha: targetDate,
        estado: 'armado',
        zona: displayZoneName,
        horarioEstimado: displayTurnoName,
        pedidosIds: sequencedOrderIds,
        stops,
        observaciones: `Punto de inicio: ${startPointLabel} | Trayecto: ${optimizedPlan?.totalDistanceKm || 0} km (~${optimizedPlan?.estimatedDurationMinutes || 0} min)`,
      });
    } catch (err: any) {
      console.error('Error al guardar hoja de ruta:', err);
      alert('Hubo un detalle al registrar en Supabase, pero los datos se guardaron localmente.');
    }

    // 2. Actualizar estado de los pedidos seleccionados
    sequencedOrderIds.forEach((oId: string) => {
      updateOrder(oId, { estado: 'listo_para_reparto', repartidorId: formDriverId });
    });

    await fetchData();
    setIsPlanning(false);
  };

  const handleDispatchRoute = async (deliveryId: string, route: DeliveryRoute) => {
    // 1. Actualizar estado de la hoja de ruta
    await updateDeliveryStatus(deliveryId, 'en_camino');
    
    // 2. Actualizar pedidos a 'en_reparto' y enviar notificación a cada cliente
    const orderIds = route.pedidosIds || [];
    const driverName = getDriverName(route.repartidorId || '');

    for (const oId of orderIds) {
      const order = orders.find(o => o.id === oId);
      const client = clients.find(c => c.id === order?.clienteId);
      const orderNumber = order?.numero || 'S/N';
      const clientName = client?.razonSocial || client?.nombre || order?.customerName || 'Cliente';

      // Actualizar pedido a en_reparto
      await updateOrder(oId, { estado: 'en_reparto' });

      // Notificación para el cliente (se muestra como popup en la app y queda guardada)
      try {
        await supabase.from('notifications').insert({
          id: `notif-disp-${oId}-${Date.now()}`,
          branch_id: route.branchId || order?.branchId || null,
          titulo: '🚚 ¡Tu compra está en camino!',
          mensaje: `Hola ${clientName}, tu pedido #${orderNumber} ya fue despachado por Química General Deheza${driverName !== 'Sin chofer' ? ` con el repartidor ${driverName}` : ''} y va en camino a tu dirección. ¡Preparate para recibirlo!`,
          tipo: 'pedido',
          cliente_id: order?.clienteId || null,
          referencia_id: oId,
          leido: false,
          fecha: new Date().toISOString(),
        });
      } catch (notifErr) {
        console.warn('Error creating customer dispatch notification:', notifErr);
      }
    }

    await fetchData();
  };

  const handleCompleteRoute = (deliveryId: string) => {
    updateDeliveryStatus(deliveryId, 'entregado');
  };

  const handleExportDeliveries = () => {
    const dataToExport = filteredDeliveries.flatMap(d => {
      return (d.stops || []).map((stop: any, sIdx: number) => ({
        RutaZona: d.zona,
        Sucursal: getBranchName(d.branchId || ''),
        Chofer: getDriverName(d.repartidorId || ''),
        Fecha: d.fecha,
        HorarioEstimado: d.horarioEstimado,
        EstadoRuta: d.estado,
        ParadaNumero: sIdx + 1,
        Cliente: stop.clienteNombre,
        Direccion: stop.direccion,
        Completado: stop.completado ? 'Sí' : 'No',
        HoraReal: stop.horaReal || '',
        MotivoFalla: stop.motivoNoEntrega || '',
      }));
    });

    const fileName = `entregas_export_${Date.now()}.xlsx`;
    const userEmail = useAdminStore.getState().currentUser?.email || '';

    supabase
      .from('export_history')
      .insert({
        usuario: userEmail,
        tipo: 'entregas',
        filtros: { branchId: activeBranchId, status: selectedStatus },
        cantidad_registros: dataToExport.length,
        nombre_archivo: fileName
      })
      .then(({ error }) => {
        if (error) console.error(error);
      });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Entregas');
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Hojas de Ruta y Repartos</h1>
          <p className="page-desc">Punto de inicio configurable (Sucursal Central o Galpón), trayecto por coordenadas e impresión de hojas de ruta</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setIsManagingDrivers(true)}>
            👥 Gestionar Repartidores
          </button>
          <button className="btn btn-secondary" onClick={handleExportDeliveries}>
            📤 Exportar Excel
          </button>
          <button className="btn btn-primary" onClick={handleOpenPlanning}>
            🚚 Planificar Nuevo Reparto
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card-wrapper" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ width: '220px' }}>
            <select 
              className="form-select"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="armado">📦 Armado / Pendiente</option>
              <option value="en_camino">🚚 En camino</option>
              <option value="entregado">✅ Completado</option>
              <option value="no_entregado">⚠️ Fallido</option>
              <option value="reprogramado">📅 Reprogramado</option>
            </select>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Hojas de ruta activas: <strong>{filteredDeliveries.length}</strong>
          </div>
        </div>
      </div>

      {/* Listado de Rutas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {filteredDeliveries.map(d => {
          const stopsList = d.stops || [];
          const completedStops = stopsList.filter((s: any) => s.completado).length;
          const failedStops = stopsList.filter((s: any) => s.motivoNoEntrega).length;
          const totalStops = stopsList.length;

          return (
            <div key={d.id} className="card-wrapper" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Ruta {d.zona}</h3>
                    <span className="badge badge-neutral">{getBranchName(d.branchId || '')}</span>
                    <span className={`badge ${
                      d.estado === 'entregado' ? 'badge-success' : 
                      d.estado === 'en_camino' ? 'badge-warning' : 'badge-neutral'
                    }`}>
                      {(d.estado || 'armado').toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Chofer: <strong>{getDriverName(d.repartidorId || '')}</strong> | Horario estimado: <strong>{d.horarioEstimado}</strong> | Fecha: {d.fecha}
                  </div>
                  {d.observaciones && (
                    <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '2px', fontWeight: '500' }}>
                      📍 {d.observaciones}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Botón de Impresión */}
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => handlePrintRoute(d, false)}
                    title="Imprimir Hoja de Ruta física para el repartidor"
                  >
                    🖨️ Imprimir Hoja
                  </button>

                  {d.estado === 'armado' && (
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '8px 14px', fontSize: '13px', background: 'var(--warning-color)' }}
                      onClick={() => handleDispatchRoute(d.id, d)}
                    >
                      🚚 Despachar Chofer
                    </button>
                  )}
                  {d.estado === 'en_camino' && (
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '8px 14px', fontSize: '13px', background: 'var(--success-color)' }}
                      onClick={() => handleCompleteRoute(d.id)}
                    >
                      ✅ Finalizar Hoja de Ruta
                    </button>
                  )}
                </div>
              </div>

              {/* Paradas de la ruta */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b' }}>
                  PARADAS ({completedStops}/{totalStops} completadas {failedStops > 0 && `| ${failedStops} fallidas`})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                  {stopsList.map((stop: any, sIdx: number) => (
                    <div key={sIdx} style={{ 
                      padding: '10px 12px', 
                      background: stop.completado ? 'var(--success-light)' : stop.motivoNoEntrega ? 'var(--error-light)' : '#f8fafc',
                      borderRadius: '6px', 
                      border: '1px solid',
                      borderColor: stop.completado ? 'var(--success-color)' : stop.motivoNoEntrega ? 'var(--error-color)' : '#e2e8f0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>#{sIdx + 1} {stop.clienteNombre}</span>
                        <span>{stop.completado ? '✅' : stop.motivoNoEntrega ? '❌' : '⏳'}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {stop.direccion}
                      </div>
                      {stop.horaReal && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Entregado: {stop.horaReal}
                        </div>
                      )}
                      {stop.motivoNoEntrega && (
                        <div style={{ fontSize: '11px', color: 'var(--error-color)', fontWeight: 'bold', marginTop: '2px' }}>
                          Motivo: {stop.motivoNoEntrega}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {deliveries.length === 0 && (
          <div className="card-wrapper" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-disabled)' }}>
            No hay hojas de ruta registradas.
          </div>
        )}
      </div>

      {/* ── MODAL: PLANIFICAR NUEVO REPARTO CON PUNTO DE INICIO CONFIGURABLE ── */}
      {isPlanning && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '1040px', width: '96%', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🚚 Planificar Hoja de Ruta y Trayecto
                  <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#e0f2fe', color: '#0284c7' }}>
                    Optimización por Coordenadas
                  </span>
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Configurá el punto de inicio de partida para optimizar el recorrido y el consumo de combustible.
                </p>
              </div>
              <button 
                type="button" 
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
                onClick={() => setIsPlanning(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRoute} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                
                {/* ── SECCIÓN 1: SELECCIÓN DE PUNTO DE INICIO (SUCURSAL CENTRAL O GALPÓN) ── */}
                <div style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🚩 Punto de Partida / Inicio del Recorrido:
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                    {/* Opción 1: SUCURSAL CENTRAL QGD */}
                    <div 
                      onClick={() => handleSelectStartPointType('sucursal_central')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '2px solid',
                        borderColor: startPointType === 'sucursal_central' ? '#0284c7' : '#e2e8f0',
                        backgroundColor: startPointType === 'sucursal_central' ? '#f0f9ff' : '#f8fafc',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="radio" 
                          checked={startPointType === 'sucursal_central'} 
                          onChange={() => handleSelectStartPointType('sucursal_central')} 
                        />
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>
                            🏬 SUCURSAL CENTRAL QGD
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Entre Ríos 151, General Deheza, Córdoba, Argentina
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Opción 2: GALPÓN / DEPÓSITO */}
                    <div 
                      onClick={() => handleSelectStartPointType('galpon_deposito')}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '2px solid',
                        borderColor: startPointType === 'galpon_deposito' ? '#ea580c' : '#e2e8f0',
                        backgroundColor: startPointType === 'galpon_deposito' ? '#fff7ed' : '#f8fafc',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input 
                          type="radio" 
                          checked={startPointType === 'galpon_deposito'} 
                          onChange={() => handleSelectStartPointType('galpon_deposito')} 
                        />
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>
                            🏭 GALPÓN / DEPÓSITO
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Cargar dirección personalizada del galpón
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Input si selecciona Galpón / Depósito */}
                  {startPointType === 'galpon_deposito' && (
                    <div style={{ marginTop: '8px', backgroundColor: '#fff7ed', padding: '10px', borderRadius: '6px', border: '1px solid #ffedd5' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#9a3412', display: 'block', marginBottom: '4px' }}>
                        Dirección del Galpón / Depósito en General Deheza:
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          value={customGalponAddress} 
                          onChange={e => setCustomGalponAddress(e.target.value)}
                          placeholder="Ej: Ruta 158 km 220, General Deheza"
                          style={{ flex: 1, fontSize: '12px' }}
                        />
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          onClick={() => handleGeocodeCustomGalpon(customGalponAddress)}
                          disabled={calculatingGalpon}
                          style={{ fontSize: '12px', padding: '6px 14px' }}
                        >
                          {calculatingGalpon ? 'Calculando...' : '📍 Fijar Coordenadas'}
                        </button>
                      </div>
                      <div style={{ fontSize: '11px', color: '#c2410c', marginTop: '4px' }}>
                        Coordenadas calculadas: <strong>[{startPointCoords.latitude.toFixed(4)}, {startPointCoords.longitude.toFixed(4)}]</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── SECCIÓN 2: MENÚS DE AGRUPACIÓN (ZONAS Y RANGOS HORARIOS) ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px', backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {/* Menú de Zonas */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 'bold', color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
                      <span>📍 Zona de Reparto</span>
                      <span style={{ fontSize: '11px', color: '#0284c7' }}>{formZona === 'all' ? 'Integral' : 'Específica'}</span>
                    </label>
                    <select 
                      className="form-select"
                      value={formZona}
                      onChange={e => setFormZona(e.target.value)}
                      style={{ fontWeight: '600' }}
                    >
                      <option value="all">🌟 TODOS (General Deheza Completo)</option>
                      {zones.map(z => (
                        <option key={z.id} value={z.nombre || z.name}>
                          📍 {z.nombre || z.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Menú de Rangos Horarios */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 'bold', color: '#0f172a', display: 'flex', justifyContent: 'space-between' }}>
                      <span>⏰ Rango Horario de Entrega</span>
                      <span style={{ fontSize: '11px', color: '#0284c7' }}>{formTurno === 'all' ? 'Todo el día' : 'Franja'}</span>
                    </label>
                    <select 
                      className="form-select"
                      value={formTurno}
                      onChange={e => setFormTurno(e.target.value)}
                      style={{ fontWeight: '600' }}
                    >
                      <option value="all">🌟 TODOS LOS RANGOS HORARIOS</option>
                      <option value="08:00 - 12:00 (Mañana)">🌅 08:00 - 12:00 (Turno Mañana)</option>
                      <option value="12:00 - 16:00 (Mediodía)">☀️ 12:00 - 16:00 (Turno Mediodía)</option>
                      <option value="16:00 - 20:00 (Tarde)">🌇 16:00 - 20:00 (Turno Tarde)</option>
                      <option value="08:00 - 20:00 (Jornada Completa)">📦 08:00 - 20:00 (Jornada Completa)</option>
                    </select>
                  </div>

                  {/* Chofer Asignado */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 'bold', color: '#0f172a' }}>
                      🚚 Chofer / Repartidor
                    </label>
                    <select 
                      className="form-select"
                      value={formDriverId}
                      onChange={e => setFormDriverId(e.target.value)}
                      required
                    >
                      <option value="">-- Seleccionar Chofer --</option>
                      {drivers.filter(d => formBranchId === 'all' || d.branchId === formBranchId).map(d => (
                        <option key={d.id} value={d.id}>{d.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grid con Mapa y Selector de Pedidos */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', minHeight: '340px' }}>
                  {/* Mapa de Trayecto */}
                  <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
                        🗺️ Mapa de Recorrido desde {startPointType === 'sucursal_central' ? 'Sucursal Central' : 'Galpón'}
                      </span>
                      {optimizedPlan && (
                        <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                          <span style={{ backgroundColor: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            🛣️ {optimizedPlan.totalDistanceKm} km
                          </span>
                          <span style={{ backgroundColor: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            ⏱️ ~{optimizedPlan.estimatedDurationMinutes} min
                          </span>
                        </div>
                      )}
                    </div>
                    <div ref={mapModalContainerRef} style={{ flex: 1, minHeight: '280px', width: '100%' }} />
                  </div>

                  {/* Tabla de Selección de Pedidos */}
                  <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 12px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
                        Pedidos Filtrados ({filteredEligibleOrders.length})
                      </span>
                      {filteredEligibleOrders.length > 0 && (
                        <button
                          type="button"
                          onClick={handleSelectAllGroup}
                          style={{
                            backgroundColor: '#0284c7',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          ⚡ Agrupar y Seleccionar Todo ({filteredEligibleOrders.length})
                        </button>
                      )}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
                      {filteredEligibleOrders.length === 0 ? (
                        <div style={{ padding: '35px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                          No hay pedidos pendientes para los filtros seleccionados (Zona: {formZona === 'all' ? 'Todas' : formZona}, Turno: {formTurno === 'all' ? 'Todos' : formTurno}).
                        </div>
                      ) : (
                        <table className="admin-table" style={{ fontSize: '12px', margin: 0 }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 1 }}>
                              <th style={{ width: '36px', padding: '6px' }}>Sel</th>
                              <th style={{ padding: '6px' }}>Pedido</th>
                              <th style={{ padding: '6px' }}>Cliente / Dirección</th>
                              <th style={{ padding: '6px', textAlign: 'right' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredEligibleOrders.map(o => {
                              const client = clients.find(c => c.id === o.clienteId);
                              const isSelected = selectedOrderIds.includes(o.id);
                              const matchedStop = optimizedPlan?.orderedStops?.find((s: any) => s.orderId === o.id);

                              return (
                                <tr 
                                  key={o.id} 
                                  style={{ cursor: 'pointer', backgroundColor: isSelected ? '#eff6ff' : 'transparent' }} 
                                  onClick={() => toggleOrderSelection(o.id)}
                                >
                                  <td style={{ padding: '6px', textAlign: 'center' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isSelected}
                                      onChange={() => {}}
                                    />
                                  </td>
                                  <td style={{ fontWeight: 'bold', padding: '6px', whiteSpace: 'nowrap' }}>
                                    {matchedStop ? (
                                      <span style={{ display: 'inline-block', backgroundColor: '#10b981', color: 'white', padding: '1px 6px', borderRadius: '10px', fontSize: '11px', marginRight: '4px' }}>
                                        #{matchedStop.stopOrder}
                                      </span>
                                    ) : null}
                                    #{o.numero}
                                  </td>
                                  <td style={{ padding: '6px' }}>
                                    <strong>{client?.razonSocial || client?.nombre || o.customerName}</strong>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                      {o.formattedAddress || o.originalAddress || client?.direccion || 'General Deheza'}
                                    </div>
                                  </td>
                                  <td style={{ padding: '6px', textAlign: 'right', fontWeight: '600' }}>
                                    {formatPrice(o.total)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>

                {/* Resumen de paradas ordenadas */}
                {optimizedPlan && optimizedPlan.orderedStops.length > 0 && (
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#16a34a' }}>
                        ⚡ Secuencia Óptima de Paradas ({optimizedPlan.orderedStops.length} paradas partiendo de {startPointCoords.name}):
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => handlePrintRoute(null, true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '12px' }}
                      >
                        🖨️ Vista Previa e Imprimir
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {optimizedPlan.orderedStops.map((stop: any) => (
                        <div key={stop.orderId} style={{ backgroundColor: 'white', padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '11px' }}>
                          <strong>#{stop.stopOrder}</strong> {stop.customerName} ({stop.formattedAddress})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '12px 16px', borderTop: '1px solid var(--border-color)', backgroundColor: '#f8fafc' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPlanning(false)}>
                  Cancelar
                </button>
                {optimizedPlan && (
                  <button 
                    type="button" 
                    className="btn btn-secondary"
                    onClick={() => handlePrintRoute(null, true)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    🖨️ Imprimir Hoja
                  </button>
                )}
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={selectedOrderIds.length === 0 || !formDriverId || isGeocoding || calculatingGalpon}
                >
                  {isGeocoding || calculatingGalpon ? 'Calculando Coordenadas...' : `🚚 Guardar y Despachar (${selectedOrderIds.length} paradas)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: GESTIÓN Y CAMBIO DE NOMBRES DE REPARTIDORES ── */}
      {isManagingDrivers && (
        <div className="modal-backdrop" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '640px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  👥 Gestión de Choferes y Repartidores
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Modificá el nombre real de cada chofer para que figure en los repartos, hojas de ruta y notificaciones al cliente.
                </p>
              </div>
              <button 
                type="button" 
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
                onClick={() => {
                  setIsManagingDrivers(false);
                  setEditingDriverId(null);
                }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '16px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {drivers.map((driver) => {
                  const isEditing = editingDriverId === driver.id;

                  return (
                    <div 
                      key={driver.id}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                              Nombre Completo del Repartidor / Chofer:
                            </label>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={editingDriverName}
                              onChange={(e) => setEditingDriverName(e.target.value)}
                              placeholder="Ej: Juan Pérez - Camión 1"
                              style={{ width: '100%' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                              Email (para inicio de sesión en la app):
                            </label>
                            <input 
                              type="email" 
                              className="form-input" 
                              value={editingDriverEmail}
                              onChange={(e) => setEditingDriverEmail(e.target.value)}
                              placeholder="Ej: juan@quimicageneraldeheza.com.ar"
                              style={{ width: '100%' }}
                            />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                                Vehículo / Patente / Móvil:
                              </label>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={editingDriverVehicle}
                                onChange={(e) => setEditingDriverVehicle(e.target.value)}
                                placeholder="Ej: Camioneta Hilux / Furgón"
                                style={{ width: '100%' }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                                Teléfono de Contacto:
                              </label>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={editingDriverPhone}
                                onChange={(e) => setEditingDriverPhone(e.target.value)}
                                placeholder="Ej: 3584123456"
                                style={{ width: '100%' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button 
                              type="button" 
                              className="btn btn-secondary" 
                              onClick={() => setEditingDriverId(null)}
                            >
                              Cancelar
                            </button>
                            <button 
                              type="button" 
                              className="btn btn-primary"
                              disabled={savingDriver || !editingDriverName.trim()}
                              onClick={async () => {
                                setSavingDriver(true);
                                await updateDriver(driver.id, {
                                  nombre: editingDriverName,
                                  email: editingDriverEmail,
                                  vehiculo: editingDriverVehicle,
                                  telefono: editingDriverPhone,
                                });
                                setSavingDriver(false);
                                setEditingDriverId(null);
                              }}
                            >
                              {savingDriver ? 'Guardando...' : '💾 Guardar Cambios'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              🚚 {driver.nombre}
                              {driver.activo ? (
                                <span style={{ backgroundColor: '#dcfce7', color: '#16a34a', fontSize: '10px', padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                                  Activo
                                </span>
                              ) : (
                                <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', fontSize: '10px', padding: '1px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                                  Inactivo
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                              Vehículo: <strong>{driver.vehiculo || 'No especificado'}</strong> | Tel: {driver.telefono || 'Sin teléfono'}
                            </div>
                            {driver.email && (
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                📧 {driver.email}
                              </div>
                            )}
                          </div>

                          <button 
                            type="button" 
                            className="btn btn-secondary"
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                            onClick={() => {
                              setEditingDriverId(driver.id);
                              setEditingDriverName(driver.nombre);
                              setEditingDriverEmail(driver.email || '');
                              setEditingDriverVehicle(driver.vehiculo || '');
                              setEditingDriverPhone(driver.telefono || '');
                            }}
                          >
                            ✏️ Editar Nombre
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {drivers.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                    No hay choferes registrados en la base de datos.
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => {
                  setIsManagingDrivers(false);
                  setEditingDriverId(null);
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
