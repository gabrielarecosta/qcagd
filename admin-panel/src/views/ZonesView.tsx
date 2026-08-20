import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAdminStore } from '../store/adminStore';
import type { DeliveryZone, Coordinate } from '@shared/types/zone';
import type { Order } from '@shared/types/order';
import { formatPrice } from '@shared/utils/formatCurrency';
import { findZoneForCoordinates, optimizeRouteStops, calculateDistanceKm, geocodeAddress } from '@shared/utils/geo';
import { suggestDehezaStreets, StreetSuggestion } from '@shared/utils/dehezaStreets';
import { zoneService, routeService, orderService } from '@shared/services';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Coordenadas centrales de General Deheza, Córdoba, Argentina
const GENERAL_DEHEZA_CENTER: [number, number] = [-63.7845, -32.7561]; // [lng, lat]

// Punto de Inicio 1: SUCURSAL CENTRAL QGD (Por defecto)
const SUCURSAL_CENTRAL_QGD = {
  name: 'SUCURSAL CENTRAL QGD',
  address: 'Entre Ríos 151, General Deheza, Córdoba, Argentina',
  latitude: -32.7650,
  longitude: -63.7860,
};
const GENERAL_DEHEZA_DEPOT = SUCURSAL_CENTRAL_QGD;

const STATUS_COLORS: Record<string, string> = {
  recibido: '#eab308', // Amarillo
  en_preparacion: '#3b82f6', // Azul
  listo_para_reparto: '#8b5cf6', // Violeta
  en_reparto: '#06b6d4', // Cyan
  entregado: '#10b981', // Verde
  cancelado: '#ef4444', // Rojo
  pending_location: '#f43f5e', // Rosa/Rojo para ubicación pendiente
};

const PALETTE_COLORS = [
  '#0284c7', // Azul céntrico
  '#16a34a', // Verde norte
  '#ea580c', // Naranja sur
  '#8b5cf6', // Púrpura este
  '#d97706', // Ámbar oeste
  '#ec4899', // Rosa
  '#0d9488', // Verde azulado
  '#6366f1', // Índigo
];

export function ZonesView() {
  const {
    zones,
    orders,
    drivers,
    fetchData,
    createZone,
    updateZone,
    deleteZone,
  } = useAdminStore();

  // Estados de vista y selección
  const [selectedZoneId, setSelectedZoneId] = useState<string | 'all' | 'unassigned'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [isEditingVertices, setIsEditingVertices] = useState(false);
  const [draftPolygon, setDraftPolygon] = useState<Coordinate[]>([]);
  const [editingZoneModal, setEditingZoneModal] = useState<DeliveryZone | null>(null);
  const [isCreatingModal, setIsCreatingModal] = useState(false);

  // Buscador inteligente de calles de General Deheza (Fuzzy Search)
  const [streetSearchText, setStreetSearchText] = useState('');
  const [showStreetSuggestions, setShowStreetSuggestions] = useState(false);

  // Formulario de Zona
  const [formZone, setFormZone] = useState<{
    name: string;
    description: string;
    color: string;
    active: boolean;
    defaultDriverId: string;
  }>({
    name: '',
    description: '',
    color: '#0284c7',
    active: true,
    defaultDriverId: '',
  });

  // Estado para optimización de ruta
  const [isOptimizingRoute, setIsOptimizingRoute] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<any | null>(null);
  const [selectedDriverForRoute, setSelectedDriverForRoute] = useState<string>('');
  const [savingRoute, setSavingRoute] = useState(false);

  // Punto de Inicio del Reparto
  const [startPointType, setStartPointType] = useState<'sucursal_central' | 'galpon_deposito'>('sucursal_central');
  const [customGalponAddress, setCustomGalponAddress] = useState('Ruta Nacional 158 km 220, General Deheza');
  const [startPointCoords, setStartPointCoords] = useState<{ latitude: number; longitude: number; name: string; address: string }>(SUCURSAL_CENTRAL_QGD);
  const [calculatingGalpon, setCalculatingGalpon] = useState(false);

  // Estado para colocación manual de pin
  const [pinDropOrder, setPinDropOrder] = useState<Order | null>(null);
  const [manualPinCoords, setManualPinCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  // Referencias de Mapa MapLibre
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const vertexMarkersRef = useRef<maplibregl.Marker[]>([]);
  const pinDropMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
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
        center: GENERAL_DEHEZA_CENTER,
        zoom: 14.2,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

      mapInstanceRef.current = map;

      map.on('load', () => {
        renderZonesOnMap();
        renderOrdersOnMap();
      });

      // Manejador de clics para dibujo de polígono
      map.on('click', (e) => {
        const lngLat: Coordinate = [Number(e.lngLat.lng.toFixed(6)), Number(e.lngLat.lat.toFixed(6))];

        if (isDrawingPolygonRef.current) {
          setDraftPolygon((prev) => {
            const next = [...prev, lngLat];
            return next;
          });
        }
      });
    }

    return () => {
      // cleanup si se desmonta
    };
  }, []);

  // Mantener referencia al estado de dibujo para el event listener del mapa
  const isDrawingPolygonRef = useRef(isDrawingPolygon);
  useEffect(() => {
    isDrawingPolygonRef.current = isDrawingPolygon;
  }, [isDrawingPolygon]);

  // Actualizar capas de polígonos y pedidos cuando cambian las zonas o pedidos
  useEffect(() => {
    if (mapInstanceRef.current && mapInstanceRef.current.isStyleLoaded()) {
      renderZonesOnMap();
      renderOrdersOnMap();
    }
  }, [zones, orders, selectedZoneId, draftPolygon, isDrawingPolygon, isEditingVertices]);

  // Actualizar marcadores de vértices al editar
  useEffect(() => {
    renderVertexMarkers();
  }, [isEditingVertices, selectedZoneId, zones, draftPolygon]);

  // Dibujar polígonos de zonas en MapLibre
  const renderZonesOnMap = () => {
    const map = mapInstanceRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Eliminar capas y fuentes previas si existen
    zones.forEach((z) => {
      if (map.getLayer(`zone-fill-${z.id}`)) map.removeLayer(`zone-fill-${z.id}`);
      if (map.getLayer(`zone-line-${z.id}`)) map.removeLayer(`zone-line-${z.id}`);
      if (map.getLayer(`zone-label-${z.id}`)) map.removeLayer(`zone-label-${z.id}`);
      if (map.getSource(`zone-source-${z.id}`)) map.removeSource(`zone-source-${z.id}`);
    });

    if (map.getLayer('draft-polygon-fill')) map.removeLayer('draft-polygon-fill');
    if (map.getLayer('draft-polygon-line')) map.removeLayer('draft-polygon-line');
    if (map.getSource('draft-polygon-source')) map.removeSource('draft-polygon-source');

    if (map.getLayer('route-line-layer')) map.removeLayer('route-line-layer');
    if (map.getSource('route-source')) map.removeSource('route-source');

    // Renderizar cada zona activa
    zones.forEach((zone) => {
      if (!zone.polygon || zone.polygon.length < 3) return;

      const isSelected = selectedZoneId === zone.id;
      // Cerrar el polígono asegurando que el primer y último punto coincidan
      const coords = [...zone.polygon];
      if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
        coords.push(coords[0]);
      }

      const geojson: any = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              id: zone.id,
              name: zone.name,
              color: zone.color,
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coords],
            },
          },
        ],
      };

      map.addSource(`zone-source-${zone.id}`, {
        type: 'geojson',
        data: geojson,
      });

      // Relleno translúcido
      map.addLayer({
        id: `zone-fill-${zone.id}`,
        type: 'fill',
        source: `zone-source-${zone.id}`,
        paint: {
          'fill-color': zone.color,
          'fill-opacity': isSelected ? 0.35 : 0.18,
        },
      });

      // Borde del polígono
      map.addLayer({
        id: `zone-line-${zone.id}`,
        type: 'line',
        source: `zone-source-${zone.id}`,
        paint: {
          'line-color': zone.color,
          'line-width': isSelected ? 3.5 : 2,
          'line-opacity': 0.9,
        },
      });
    });

    // Renderizar polígono en borrador si se está dibujando
    if (draftPolygon.length >= 2) {
      const draftCoords = [...draftPolygon];
      if (draftCoords.length >= 3) {
        draftCoords.push(draftCoords[0]);
      }

      const draftGeojson: any = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: draftCoords.length >= 3 ? 'Polygon' : 'LineString',
              coordinates: draftCoords.length >= 3 ? [draftCoords] : draftCoords,
            } as any,
          },
        ],
      };

      map.addSource('draft-polygon-source', {
        type: 'geojson',
        data: draftGeojson,
      });

      if (draftCoords.length >= 3) {
        map.addLayer({
          id: 'draft-polygon-fill',
          type: 'fill',
          source: 'draft-polygon-source',
          paint: {
            'fill-color': formZone.color || '#0284c7',
            'fill-opacity': 0.3,
          },
        });
      }

      map.addLayer({
        id: 'draft-polygon-line',
        type: 'line',
        source: 'draft-polygon-source',
        paint: {
          'line-color': formZone.color || '#0284c7',
          'line-width': 2.5,
          'line-dasharray': [2, 2],
        },
      });
    }

    // Renderizar línea de ruta optimizada si existe
    if (optimizedRoute && optimizedRoute.orderedStops.length > 0) {
      const routeCoordinates = [
        [GENERAL_DEHEZA_DEPOT.longitude, GENERAL_DEHEZA_DEPOT.latitude],
        ...optimizedRoute.orderedStops.map((s: any) => [s.longitude, s.latitude]),
      ];

      const routeGeojson: any = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeCoordinates,
            },
          },
        ],
      };

      map.addSource('route-source', {
        type: 'geojson',
        data: routeGeojson,
      });

      map.addLayer({
        id: 'route-line-layer',
        type: 'line',
        source: 'route-source',
        paint: {
          'line-color': '#16a34a',
          'line-width': 4,
          'line-opacity': 0.85,
        },
      });
    }
  };

  // Renderizar marcadores de pedidos en MapLibre
  const renderOrdersOnMap = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Limpiar marcadores anteriores
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Agregar marcador del Depósito Central
    const depotEl = document.createElement('div');
    depotEl.className = 'depot-map-marker';
    depotEl.innerHTML = `
      <div style="background:#0f172a; color:#fff; border-radius:50%; width:32px; height:32px; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.3); font-size:16px; border:2px solid #fff;">
        🏢
      </div>
    `;
    const depotPopup = new maplibregl.Popup({ offset: 15 }).setHTML(`
      <div style="padding:4px; font-family:sans-serif;">
        <strong style="color:#0f172a;">${GENERAL_DEHEZA_DEPOT.name}</strong>
        <div style="font-size:12px; color:#64748b;">Punto de partida de repartos</div>
      </div>
    `);
    const depotMarker = new maplibregl.Marker({ element: depotEl })
      .setLngLat([GENERAL_DEHEZA_DEPOT.longitude, GENERAL_DEHEZA_DEPOT.latitude])
      .setPopup(depotPopup)
      .addTo(map);
    markersRef.current.push(depotMarker);

    // Filtrar pedidos según zona seleccionada
    const visibleOrders = orders.filter((ord) => {
      if (ord.estado === 'cancelado') return false;
      if (ord.deliveryMethod === 'retiro' || ord.deliveryMethod === 'whatsapp') return false;
      if (selectedZoneId === 'all') return true;
      if (selectedZoneId === 'unassigned') return !ord.zoneId;
      return ord.zoneId === selectedZoneId;
    });

    visibleOrders.forEach((ord) => {
      if (!ord.latitude || !ord.longitude) return;

      const markerEl = document.createElement('div');
      markerEl.className = 'order-map-marker';
      const color = STATUS_COLORS[ord.estado] || '#64748b';

      // Si está en la ruta optimizada, mostrar el número de parada
      const routeStop = optimizedRoute?.orderedStops.find((s: any) => s.orderId === ord.id);
      const stopBadge = routeStop ? `<span style="font-size:11px; font-weight:800;">#${routeStop.stopOrder}</span>` : '📦';

      markerEl.innerHTML = `
        <div style="background:${color}; color:#fff; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 6px rgba(0,0,0,0.25); border:2px solid #fff; cursor:pointer; transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">
          ${stopBadge}
        </div>
      `;

      markerEl.addEventListener('click', () => {
        setSelectedOrder(ord);
      });

      const popupHtml = `
        <div style="font-family:sans-serif; padding:4px; min-width:180px;">
          <div style="font-weight:700; color:#0f172a; font-size:13px; margin-bottom:2px;">${ord.numero}</div>
          <div style="font-size:12px; color:#334155;"><strong>Cliente:</strong> ${ord.customerName || 'Cliente'}</div>
          <div style="font-size:12px; color:#475569;"><strong>Dirección:</strong> ${ord.formattedAddress || ord.originalAddress || '—'}</div>
          <div style="font-size:12px; color:#0284c7; margin-top:2px;"><strong>Total:</strong> ${formatPrice(ord.total)}</div>
          <div style="margin-top:4px; font-size:11px; padding:2px 6px; border-radius:4px; background:${color}22; color:${color}; font-weight:600; display:inline-block;">
            ${ord.estado.toUpperCase().replace(/_/g, ' ')}
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(popupHtml);

      const marker = new maplibregl.Marker({ element: markerEl })
        .setLngLat([ord.longitude, ord.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  };

  // Renderizar marcadores de vértices al editar polígono
  const renderVertexMarkers = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    vertexMarkersRef.current.forEach((m) => m.remove());
    vertexMarkersRef.current = [];

    if (!isEditingVertices && !isDrawingPolygon) return;

    const currentPolygon = isDrawingPolygon
      ? draftPolygon
      : zones.find((z) => z.id === selectedZoneId)?.polygon || [];

    currentPolygon.forEach((coord, idx) => {
      const el = document.createElement('div');
      el.className = 'vertex-handle';
      el.innerHTML = `
        <div style="background:#fff; border:2px solid #0284c7; width:14px; height:14px; border-radius:50%; box-shadow:0 1px 4px rgba(0,0,0,0.3); cursor:grab;"></div>
      `;

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(coord)
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        const updated: Coordinate = [Number(lngLat.lng.toFixed(6)), Number(lngLat.lat.toFixed(6))];

        if (isDrawingPolygon) {
          setDraftPolygon((prev) => {
            const next = [...prev];
            next[idx] = updated;
            return next;
          });
        } else if (selectedZoneId !== 'all' && selectedZoneId !== 'unassigned') {
          const zone = zones.find((z) => z.id === selectedZoneId);
          if (zone) {
            const nextCoords = [...zone.polygon];
            nextCoords[idx] = updated;
            updateZone(zone.id, { polygon: nextCoords });
          }
        }
      });

      vertexMarkersRef.current.push(marker);
    });
  };

  // Centrar mapa en una zona seleccionada
  const handleSelectZone = (zoneId: string | 'all' | 'unassigned') => {
    setSelectedZoneId(zoneId);
    setSelectedOrder(null);
    setOptimizedRoute(null);

    const map = mapInstanceRef.current;
    if (!map) return;

    if (zoneId === 'all' || zoneId === 'unassigned') {
      map.flyTo({ center: GENERAL_DEHEZA_CENTER, zoom: 14.2 });
      return;
    }

    const zone = zones.find((z) => z.id === zoneId);
    if (zone && zone.polygon && zone.polygon.length >= 3) {
      const bounds = new maplibregl.LngLatBounds();
      zone.polygon.forEach((coord) => bounds.extend(coord));
      map.fitBounds(bounds, { padding: 50, maxZoom: 16 });
    }
  };

  // Iniciar dibujo de nueva zona
  const handleStartDrawZone = () => {
    setIsDrawingPolygon(true);
    setIsEditingVertices(false);
    setDraftPolygon([]);
    setFormZone({
      name: `Zona ${zones.length + 1}`,
      description: '',
      color: PALETTE_COLORS[zones.length % PALETTE_COLORS.length],
      active: true,
      defaultDriverId: '',
    });
  };

  // Finalizar dibujo y guardar zona
  const handleSaveDraftZone = async () => {
    if (draftPolygon.length < 3) {
      alert('Debes hacer clic en al menos 3 puntos del mapa para formar una zona poligonal.');
      return;
    }
    setIsCreatingModal(true);
  };

  const handleConfirmCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createZone({
        name: formZone.name,
        description: formZone.description,
        color: formZone.color,
        active: formZone.active,
        polygon: draftPolygon,
        defaultDriverId: formZone.defaultDriverId || null,
      });

      // Reevaluar pedidos para auto-asignar
      await zoneService.reevaluateAutomaticOrders();
      await fetchData();

      setIsDrawingPolygon(false);
      setDraftPolygon([]);
      setIsCreatingModal(false);
      alert('¡Zona creada correctamente! Los pedidos correspondientes han sido asignados.');
    } catch (err: any) {
      alert('Error al crear la zona: ' + err.message);
    }
  };

  const handleCancelDraw = () => {
    setIsDrawingPolygon(false);
    setDraftPolygon([]);
  };

  // Modal para editar zona existente
  const handleOpenEditZone = (zone: DeliveryZone) => {
    setEditingZoneModal(zone);
    setFormZone({
      name: zone.name,
      description: zone.description || '',
      color: zone.color,
      active: zone.active !== false,
      defaultDriverId: zone.defaultDriverId || zone.default_driver_id || '',
    });
  };

  const handleSaveEditZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingZoneModal) return;

    try {
      await updateZone(editingZoneModal.id, {
        name: formZone.name,
        description: formZone.description,
        color: formZone.color,
        active: formZone.active,
        defaultDriverId: formZone.defaultDriverId || null,
      });

      await zoneService.reevaluateAutomaticOrders();
      await fetchData();

      setEditingZoneModal(null);
      alert('Zona actualizada con éxito.');
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    }
  };

  const handleDeleteZone = async (zone: DeliveryZone) => {
    if (window.confirm(`¿Estás seguro de eliminar la "${zone.name}"? Los pedidos quedarán sin zona.`)) {
      try {
        await deleteZone(zone.id);
        await zoneService.reevaluateAutomaticOrders();
        await fetchData();
        if (selectedZoneId === zone.id) setSelectedZoneId('all');
      } catch (err: any) {
        alert('Error al eliminar: ' + err.message);
      }
    }
  };

  // Reasignación manual de zona desde el popup de pedido
  const handleReassignOrderZone = async (orderId: string, targetZoneId: string | null) => {
    try {
      await orderService.reassignZoneManually(orderId, targetZoneId);
      await fetchData();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, zoneId: targetZoneId, zoneAssignmentType: 'manual' } : null));
      }
    } catch (err: any) {
      alert('Error al reasignar zona: ' + err.message);
    }
  };

  // Colocación manual de pin en el mapa
  const handleStartManualPin = (order: Order) => {
    setPinDropOrder(order);
    const initialLat = order.latitude || GENERAL_DEHEZA_CENTER[1];
    const initialLng = order.longitude || GENERAL_DEHEZA_CENTER[0];
    setManualPinCoords({ lat: initialLat, lng: initialLng });

    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo({ center: [initialLng, initialLat], zoom: 16 });

      if (pinDropMarkerRef.current) pinDropMarkerRef.current.remove();

      const el = document.createElement('div');
      el.innerHTML = `
        <div style="background:#f43f5e; color:#fff; border-radius:50%; width:36px; height:36px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,0.3); border:3px solid #fff; cursor:grab; font-size:18px;">
          📍
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([initialLng, initialLat])
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        setManualPinCoords({ lat: lngLat.lat, lng: lngLat.lng });
      });

      pinDropMarkerRef.current = marker;
    }
  };

  const handleConfirmManualPin = async () => {
    if (!pinDropOrder || !manualPinCoords) return;

    setSavingPin(true);
    try {
      await orderService.updateLocationAndZone(pinDropOrder.id, {
        latitude: manualPinCoords.lat,
        longitude: manualPinCoords.lng,
        locationStatus: 'manual_pin',
      });

      await fetchData();
      if (pinDropMarkerRef.current) pinDropMarkerRef.current.remove();
      pinDropMarkerRef.current = null;
      setPinDropOrder(null);
      setManualPinCoords(null);
      alert('Ubicación guardada y zona asignada automáticamente.');
    } catch (err: any) {
      alert('Error al guardar ubicación: ' + err.message);
    } finally {
      setSavingPin(false);
    }
  };

  const handleCancelManualPin = () => {
    if (pinDropMarkerRef.current) pinDropMarkerRef.current.remove();
    pinDropMarkerRef.current = null;
    setPinDropOrder(null);
    setManualPinCoords(null);
  };

  // Optimización de ruta para la zona seleccionada
  const handleOptimizeRoute = () => {
    if (selectedZoneId === 'all' || selectedZoneId === 'unassigned') {
      alert('Por favor selecciona una zona específica para calcular su ruta óptima de reparto.');
      return;
    }

    const zone = zones.find((z) => z.id === selectedZoneId);
    const eligibleOrders = orders.filter(
      (o) => o.zoneId === selectedZoneId && o.latitude && o.longitude && o.estado !== 'entregado' && o.estado !== 'cancelado'
    );

    if (eligibleOrders.length === 0) {
      alert('No hay pedidos con coordenadas válidas pendientes de entrega en esta zona.');
      return;
    }

    const stopsInput = eligibleOrders.map((o) => ({
      orderId: o.id,
      latitude: o.latitude!,
      longitude: o.longitude!,
      numero: o.numero,
      customerName: o.customerName,
      formattedAddress: o.formattedAddress || o.originalAddress,
      total: o.total,
    }));

    const result = optimizeRouteStops(startPointCoords, stopsInput, 8, 30);
    setOptimizedRoute(result);
    setSelectedDriverForRoute(zone?.defaultDriverId || zone?.default_driver_id || '');
    setIsOptimizingRoute(true);
  };

  // Re-optimizar al cambiar punto de inicio
  const handleRecalculateRouteStart = async (type: 'sucursal_central' | 'galpon_deposito', customAddr?: string) => {
    setStartPointType(type);
    let newCoords = SUCURSAL_CENTRAL_QGD;

    if (type === 'galpon_deposito') {
      const addrToUse = customAddr || customGalponAddress;
      setCalculatingGalpon(true);
      try {
        const geo = await geocodeAddress(addrToUse, 'General Deheza', 'Córdoba');
        if (geo) {
          newCoords = {
            name: 'GALPÓN / DEPÓSITO',
            address: geo.formattedAddress || addrToUse,
            latitude: geo.latitude,
            longitude: geo.longitude,
          };
        } else {
          newCoords = {
            name: 'GALPÓN / DEPÓSITO',
            address: `${addrToUse}, General Deheza`,
            latitude: -32.7566,
            longitude: -63.7861,
          };
        }
      } catch (e) {
        newCoords = {
          name: 'GALPÓN / DEPÓSITO',
          address: `${addrToUse}, General Deheza`,
          latitude: -32.7566,
          longitude: -63.7861,
        };
      } finally {
        setCalculatingGalpon(false);
      }
    }

    setStartPointCoords(newCoords);

    if (optimizedRoute && optimizedRoute.orderedStops) {
      const stopsInput = optimizedRoute.orderedStops.map((s: any) => ({
        orderId: s.orderId,
        latitude: s.latitude,
        longitude: s.longitude,
        numero: s.numero,
        customerName: s.customerName,
        formattedAddress: s.formattedAddress,
        total: s.total,
      }));
      const result = optimizeRouteStops(newCoords, stopsInput, 8, 30);
      setOptimizedRoute(result);
    }
  };

  // Guardar y despachar ruta de reparto
  const handleSaveRoute = async () => {
    if (!optimizedRoute || selectedZoneId === 'all' || selectedZoneId === 'unassigned') return;

    setSavingRoute(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await routeService.createRoute({
        zoneId: selectedZoneId,
        driverId: selectedDriverForRoute || null,
        date: today,
        totalDistance: optimizedRoute.totalDistanceKm,
        estimatedDuration: optimizedRoute.estimatedDurationMinutes,
        stops: optimizedRoute.orderedStops.map((s: any) => ({
          orderId: s.orderId,
          stopOrder: s.stopOrder,
        })),
      });

      await fetchData();
      setIsOptimizingRoute(false);
      setOptimizedRoute(null);
      alert('¡Hoja de ruta guardada y asignada al chofer exitosamente!');
    } catch (err: any) {
      alert('Error al guardar la ruta: ' + err.message);
    } finally {
      setSavingRoute(false);
    }
  };

  // Estadísticas por zona
  const zoneStats = useMemo(() => {
    const stats: Record<string, { total: number; pendientes: number; enPreparacion: number; listos: number; enReparto: number; entregados: number }> = {};

    zones.forEach((z) => {
      stats[z.id] = { total: 0, pendientes: 0, enPreparacion: 0, listos: 0, enReparto: 0, entregados: 0 };
    });
    stats['unassigned'] = { total: 0, pendientes: 0, enPreparacion: 0, listos: 0, enReparto: 0, entregados: 0 };

    orders.forEach((o) => {
      if (o.estado === 'cancelado') return;
      const key = o.zoneId && stats[o.zoneId] ? o.zoneId : 'unassigned';

      stats[key].total++;
      if (o.estado === 'recibido') stats[key].pendientes++;
      else if (o.estado === 'en_preparacion') stats[key].enPreparacion++;
      else if (o.estado === 'listo_para_reparto') stats[key].listos++;
      else if (o.estado === 'en_reparto') stats[key].enReparto++;
      else if (o.estado === 'entregado') stats[key].entregados++;
    });

    return stats;
  }, [zones, orders]);

  // Pedidos sin ubicación
  const pendingLocationOrders = useMemo(() => {
    return orders.filter((o) => (!o.latitude || !o.longitude) && o.estado !== 'entregado' && o.estado !== 'cancelado');
  }, [orders]);

  return (
    <div className="view-container" style={{ padding: '0px', height: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column' }}>
      {/* ── BARRA SUPERIOR DE HERRAMIENTAS Y ESTADO ── */}
      <div
        style={{
          backgroundColor: '#fff',
          borderBottom: '1px solid #e2e8f0',
          padding: '12px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          zIndex: 10,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🗺️ Zonas de Reparto y Georreferenciación
            <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#e0f2fe', color: '#0284c7' }}>
              General Deheza, Córdoba
            </span>
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
            Polígonos geográficos editables, detección automática de zonas y optimización inteligente de rutas.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Buscador y sugeridor de calles de General Deheza */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '2px 8px' }}>
              <span style={{ fontSize: '12px', marginRight: '4px' }}>🔍</span>
              <input
                type="text"
                placeholder="Buscar calle en G. Deheza..."
                value={streetSearchText}
                onChange={(e) => {
                  setStreetSearchText(e.target.value);
                  setShowStreetSuggestions(true);
                }}
                onFocus={() => setShowStreetSuggestions(true)}
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', width: '180px', color: '#0f172a' }}
              />
              {streetSearchText && (
                <button
                  onClick={() => {
                    setStreetSearchText('');
                    setShowStreetSuggestions(false);
                  }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '11px', color: '#64748b' }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Menú flotante de sugerencias de calles */}
            {showStreetSuggestions && streetSearchText.trim().length >= 2 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  width: '260px',
                  backgroundColor: '#fff',
                  borderRadius: '6px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                  border: '1px solid #e2e8f0',
                  zIndex: 100,
                  maxHeight: '220px',
                  overflowY: 'auto',
                  padding: '4px',
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', padding: '4px 8px' }}>
                  Calles Oficiales Sugeridas:
                </div>
                {suggestDehezaStreets(streetSearchText, 5).map((sug) => (
                  <div
                    key={sug.street.name}
                    onClick={() => {
                      setStreetSearchText(sug.street.name);
                      setShowStreetSuggestions(false);
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.flyTo({
                          center: [sug.longitude, sug.latitude],
                          zoom: 16.5,
                        });
                      }
                    }}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      color: '#0f172a',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <span>📍 {sug.street.name}</span>
                    {sug.street.zoneHint && (
                      <span style={{ fontSize: '10px', color: '#0284c7', fontWeight: '600', backgroundColor: '#e0f2fe', padding: '1px 5px', borderRadius: '4px' }}>
                        {sug.street.zoneHint}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isDrawingPolygon ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#fef3c7', padding: '6px 12px', borderRadius: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#92400e' }}>
                ✏️ Haz clic en el mapa ({draftPolygon.length} vértices colocados)
              </span>
              <button
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={handleSaveDraftZone}
                disabled={draftPolygon.length < 3}
              >
                Finalizar Zona
              </button>
              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleCancelDraw}>
                Cancelar
              </button>
            </div>
          ) : pinDropOrder ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#ffe4e6', padding: '6px 12px', borderRadius: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#9f1239' }}>
                📍 Arrastra el pin rojo al domicilio de {pinDropOrder.numero}
              </span>
              <button
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#e11d48', borderColor: '#e11d48' }}
                onClick={handleConfirmManualPin}
                disabled={savingPin}
              >
                {savingPin ? 'Guardando...' : 'Confirmar Ubicación'}
              </button>
              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleCancelManualPin}>
                Cancelar
              </button>
            </div>
          ) : (
            <>
              <button className="btn btn-primary" onClick={handleStartDrawZone} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                ➕ Crear Nueva Zona Poligonal
              </button>

              {selectedZoneId !== 'all' && selectedZoneId !== 'unassigned' && (
                <>
                  <button
                    className={`btn ${isEditingVertices ? 'btn-warning' : 'btn-secondary'}`}
                    onClick={() => setIsEditingVertices(!isEditingVertices)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isEditingVertices ? '✔ Terminar Edición de Vértices' : '📐 Editar Vértices'}
                  </button>

                  <button
                    className="btn"
                    style={{ backgroundColor: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={handleOptimizeRoute}
                  >
                    ⚡ Optimizar Ruta
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── CUERPO PRINCIPAL: MAPA INTERACTIVO + PANEL LATERAL ── */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {/* MAPA MAPLIBRE */}
        <div ref={mapContainerRef} style={{ flex: 1, height: '100%', width: '100%' }} />

        {/* ── PANEL LATERAL FLOTANTE DE ZONAS Y PEDIDOS ── */}
        <div
          style={{
            width: '380px',
            backgroundColor: '#ffffff',
            borderLeft: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 5,
            boxShadow: '-4px 0 20px rgba(0,0,0,0.05)',
            maxHeight: '100%',
          }}
        >
          {/* Selector de pestañas */}
          <div style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
            <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '4px' }}>
              <button
                className={`btn btn-sm ${selectedZoneId === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => handleSelectZone('all')}
                style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
              >
                Todas ({orders.length})
              </button>

              {zones.map((z) => {
                const isSel = selectedZoneId === z.id;
                const count = zoneStats[z.id]?.total || 0;
                return (
                  <button
                    key={z.id}
                    onClick={() => handleSelectZone(z.id)}
                    style={{
                      fontSize: '11px',
                      whiteSpace: 'nowrap',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${isSel ? z.color : '#cbd5e1'}`,
                      backgroundColor: isSel ? z.color : '#fff',
                      color: isSel ? '#fff' : '#334155',
                      fontWeight: isSel ? '700' : '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isSel ? '#fff' : z.color }}></span>
                    {z.name} ({count})
                  </button>
                );
              })}

              {zoneStats['unassigned']?.total > 0 && (
                <button
                  className={`btn btn-sm ${selectedZoneId === 'unassigned' ? 'btn-danger' : 'btn-secondary'}`}
                  onClick={() => handleSelectZone('unassigned')}
                  style={{ fontSize: '11px', whiteSpace: 'nowrap', color: selectedZoneId === 'unassigned' ? '#fff' : '#e11d48' }}
                >
                  Sin Zona ({zoneStats['unassigned'].total})
                </button>
              )}
            </div>
          </div>

          {/* Contenido del panel lateral */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            {/* Alerta de ubicaciones pendientes si existen */}
            {pendingLocationOrders.length > 0 && (
              <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#9f1239' }}>
                    ⚠️ {pendingLocationOrders.length} pedidos sin geolocalizar
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '11px', color: '#be123c', lineHeight: '1.4' }}>
                  Direcciones no geocodificadas automáticamente. Haz clic en "Ubicar en mapa" para posicionar el pin.
                </p>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pendingLocationOrders.slice(0, 3).map((po) => (
                    <div key={po.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ffe4e6' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#334155' }}>{po.numero} - {po.formattedAddress || po.originalAddress}</span>
                      <button
                        className="btn btn-sm"
                        style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: '#e11d48', color: '#fff' }}
                        onClick={() => handleStartManualPin(po)}
                      >
                        📍 Ubicar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Información y estadísticas de la zona seleccionada */}
            {selectedZoneId !== 'all' && selectedZoneId !== 'unassigned' && (
              (() => {
                const currentZone = zones.find((z) => z.id === selectedZoneId);
                const stats = zoneStats[selectedZoneId] || { total: 0, pendientes: 0, enPreparacion: 0, listos: 0, enReparto: 0, entregados: 0 };
                const driver = drivers.find((d) => d.id === currentZone?.defaultDriverId || d.id === currentZone?.default_driver_id);

                return (
                  <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', border: `1px solid ${currentZone?.color || '#cbd5e1'}`, backgroundColor: `${currentZone?.color || '#0284c7'}08` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: currentZone?.color }}></span>
                          {currentZone?.name}
                        </h3>
                        {currentZone?.description && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>{currentZone.description}</p>}
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-sm btn-secondary" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => currentZone && handleOpenEditZone(currentZone)}>
                          ✏️ Editar
                        </button>
                        <button className="btn btn-sm btn-danger" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => currentZone && handleDeleteZone(currentZone)}>
                          🗑️
                        </button>
                      </div>
                    </div>

                    <div style={{ fontSize: '12px', color: '#334155', marginBottom: '10px' }}>
                      <strong>Repartidor habitual:</strong> {driver ? `🚚 ${driver.nombre}` : 'No asignado'}
                    </div>

                    {/* Grilla de estados */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '11px', textAlign: 'center' }}>
                      <div style={{ background: '#fef9c3', padding: '6px 4px', borderRadius: '4px', border: '1px solid #fef08a' }}>
                        <div style={{ fontWeight: '700', color: '#854d0e', fontSize: '13px' }}>{stats.pendientes}</div>
                        <div style={{ color: '#a16207' }}>Pendientes</div>
                      </div>
                      <div style={{ background: '#dbeafe', padding: '6px 4px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                        <div style={{ fontWeight: '700', color: '#1e40af', fontSize: '13px' }}>{stats.enPreparacion}</div>
                        <div style={{ color: '#1d4ed8' }}>En Prep.</div>
                      </div>
                      <div style={{ background: '#f3e8ff', padding: '6px 4px', borderRadius: '4px', border: '1px solid #e9d5ff' }}>
                        <div style={{ fontWeight: '700', color: '#6b21a8', fontSize: '13px' }}>{stats.listos}</div>
                        <div style={{ color: '#7e22ce' }}>Listos</div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* Listado de pedidos de la zona / vista */}
            <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '700', color: '#334155' }}>
              📦 Pedidos ({orders.filter((o) => selectedZoneId === 'all' ? true : selectedZoneId === 'unassigned' ? !o.zoneId : o.zoneId === selectedZoneId).length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {orders
                .filter((o) => (selectedZoneId === 'all' ? true : selectedZoneId === 'unassigned' ? !o.zoneId : o.zoneId === selectedZoneId))
                .map((ord) => {
                  const isSelected = selectedOrder?.id === ord.id;
                  const color = STATUS_COLORS[ord.estado] || '#64748b';
                  const zoneOfOrder = zones.find((z) => z.id === ord.zoneId);

                  return (
                    <div
                      key={ord.id}
                      onClick={() => {
                        setSelectedOrder(ord);
                        if (ord.latitude && ord.longitude && mapInstanceRef.current) {
                          mapInstanceRef.current.flyTo({ center: [ord.longitude, ord.latitude], zoom: 16 });
                        }
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                        border: `1px solid ${isSelected ? '#22c55e' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '700', fontSize: '12px', color: '#0f172a' }}>{ord.numero}</span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: `${color}18`, color: color, fontWeight: '700' }}>
                          {ord.estado.toUpperCase().replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: '#334155', fontWeight: '500' }}>{ord.customerName || 'Cliente'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        📍 {ord.formattedAddress || ord.originalAddress || 'Sin dirección'}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11px' }}>
                        <span style={{ fontWeight: '700', color: '#0284c7' }}>{formatPrice(ord.total)}</span>
                        {zoneOfOrder ? (
                          <span style={{ fontSize: '10px', color: zoneOfOrder.color, fontWeight: '600' }}>
                            🏷️ {zoneOfOrder.name} {ord.zoneAssignmentType === 'manual' ? '(Manual)' : ''}
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#e11d48', fontWeight: '600' }}>⚠️ Sin zona</span>
                        )}
                      </div>

                      {/* Botón rápido de ubicación manual si no tiene coordenadas */}
                      {(!ord.latitude || !ord.longitude) && (
                        <button
                          className="btn btn-sm"
                          style={{ marginTop: '8px', width: '100%', fontSize: '10px', padding: '4px', backgroundColor: '#e11d48', color: '#fff' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartManualPin(ord);
                          }}
                        >
                          📍 Posicionar Pin en el Mapa
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: DETALLES DE PEDIDO Y REASIGNACIÓN MANUAL ── */}
      {selectedOrder && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                Detalles del Pedido {selectedOrder.numero}
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#334155' }}>
              <div><strong>Cliente:</strong> {selectedOrder.customerName || '—'}</div>
              <div><strong>Teléfono:</strong> {selectedOrder.customerPhone || '—'}</div>
              <div><strong>Dirección:</strong> {selectedOrder.formattedAddress || selectedOrder.originalAddress || '—'}</div>
              <div><strong>Total:</strong> {formatPrice(selectedOrder.total)}</div>
              <div><strong>Estado:</strong> <span style={{ fontWeight: '700', color: STATUS_COLORS[selectedOrder.estado] }}>{selectedOrder.estado}</span></div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#0f172a' }}>
                  Zona de Reparto Asignada:
                </label>
                <select
                  className="form-control"
                  style={{ width: '100%', fontSize: '13px' }}
                  value={selectedOrder.zoneId || ''}
                  onChange={(e) => handleReassignOrderZone(selectedOrder.id, e.target.value || null)}
                >
                  <option value="">-- Sin zona asignada --</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} {selectedOrder.zoneId === z.id ? '(Actual)' : ''}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                  {selectedOrder.zoneAssignmentType === 'manual'
                    ? '🔒 Asignación forzada manualmente (no será sobrescrita automáticamente).'
                    : '⚡ Asignada automáticamente por polígono geográfico.'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: '12px' }}
                  onClick={() => {
                    handleStartManualPin(selectedOrder);
                    setSelectedOrder(null);
                  }}
                >
                  📍 Reposicionar Pin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CREAR / EDITAR ZONA POLIGONAL ── */}
      {(isCreatingModal || editingZoneModal) && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              {isCreatingModal ? 'Guardar Nueva Zona de Reparto' : `Editar ${editingZoneModal?.name}`}
            </h3>

            <form onSubmit={isCreatingModal ? handleConfirmCreateZone : handleSaveEditZone}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Nombre de la Zona</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="Ej: Zona Centro, Zona Norte..."
                  value={formZone.name}
                  onChange={(e) => setFormZone({ ...formZone, name: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Descripción / Referencias</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Bv. San Martín y calles aledañas"
                  value={formZone.description}
                  onChange={(e) => setFormZone({ ...formZone, description: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Color Identificatorio</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {PALETTE_COLORS.map((col) => (
                    <div
                      key={col}
                      onClick={() => setFormZone({ ...formZone, color: col })}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: col,
                        cursor: 'pointer',
                        border: formZone.color === col ? '3px solid #0f172a' : '2px solid #fff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>Repartidor Asignado por Defecto</label>
                <select
                  className="form-control"
                  value={formZone.defaultDriverId}
                  onChange={(e) => setFormZone({ ...formZone, defaultDriverId: e.target.value })}
                >
                  <option value="">-- Sin chofer predeterminado --</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre} ({d.vehiculo || 'Repartidor'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsCreatingModal(false);
                    setEditingZoneModal(null);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {isCreatingModal ? 'Guardar Zona' : 'Actualizar Zona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: HOJA DE RUTA OPTIMIZADA (TSP) ── */}
      {isOptimizingRoute && optimizedRoute && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '520px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                ⚡ Hoja de Ruta Optimizada
              </h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setIsOptimizingRoute(false)}>✕</button>
            </div>

            {/* Resumen métrico */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px', textAlign: 'center' }}>
              <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{optimizedRoute.orderedStops.length}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Paradas</div>
              </div>
              <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#065f46' }}>{optimizedRoute.totalDistanceKm} km</div>
                <div style={{ fontSize: '11px', color: '#047857' }}>Distancia Total</div>
              </div>
              <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e40af' }}>{optimizedRoute.estimatedDurationMinutes} min</div>
                <div style={{ fontSize: '11px', color: '#1d4ed8' }}>Tiempo Estimado</div>
              </div>
            </div>

            {/* Selector de Punto de Inicio */}
            <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
                🚩 Punto de Partida del Recorrido:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
                <div
                  onClick={() => handleRecalculateRouteStart('sucursal_central')}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: startPointType === 'sucursal_central' ? '#0284c7' : '#cbd5e1',
                    backgroundColor: startPointType === 'sucursal_central' ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#0f172a',
                  }}
                >
                  🏬 Sucursal Central QGD
                </div>
                <div
                  onClick={() => handleRecalculateRouteStart('galpon_deposito')}
                  style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: startPointType === 'galpon_deposito' ? '#ea580c' : '#cbd5e1',
                    backgroundColor: startPointType === 'galpon_deposito' ? '#fff7ed' : '#fff',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#0f172a',
                  }}
                >
                  🏭 Galpón / Depósito
                </div>
              </div>

              {startPointType === 'galpon_deposito' && (
                <div style={{ marginTop: '6px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      className="form-control"
                      value={customGalponAddress}
                      onChange={(e) => setCustomGalponAddress(e.target.value)}
                      placeholder="Dirección del galpón..."
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleRecalculateRouteStart('galpon_deposito', customGalponAddress)}
                      disabled={calculatingGalpon}
                      style={{ fontSize: '11px' }}
                    >
                      {calculatingGalpon ? '...' : '📍 Fijar'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Selector de Repartidor */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>
                Asignar Repartidor para esta Ruta:
              </label>
              <select
                className="form-control"
                value={selectedDriverForRoute}
                onChange={(e) => setSelectedDriverForRoute(e.target.value)}
              >
                <option value="">-- Seleccionar Repartidor --</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre} ({d.vehiculo || 'Repartidor'})
                  </option>
                ))}
              </select>
            </div>

            {/* Paradas ordenadas */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '14px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '6px' }}>
                Secuencia de Visitas Sugerida:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ padding: '6px 10px', background: '#0f172a', color: '#fff', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                  🏢 Salida: {startPointCoords.name} ({startPointCoords.address})
                </div>
                {optimizedRoute.orderedStops.map((stop: any) => (
                  <div
                    key={stop.orderId}
                    style={{
                      padding: '8px 10px',
                      background: '#fff',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: '#16a34a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800' }}>
                        {stop.stopOrder}
                      </span>
                      <div>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{stop.numero} - {stop.customerName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{stop.formattedAddress}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: '600' }}>{formatPrice(stop.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setIsOptimizingRoute(false)}>
                Cancelar
              </button>
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const printWindow = window.open('', '_blank');
                  if (!printWindow) return;
                  const zone = zones.find(z => z.id === selectedZoneId);
                  const driver = drivers.find(d => d.id === selectedDriverForRoute);
                  const stops = optimizedRoute.orderedStops || [];
                  const total = stops.reduce((acc: number, s: any) => acc + (s.total || 0), 0);

                  const html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <title>Hoja de Ruta - ${zone?.name || 'Zona'} - Química General Deheza</title>
                      <meta charset="utf-8" />
                      <style>
                        @page { size: A4 portrait; margin: 12mm 14mm; }
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #0f172a; margin: 0; }
                        .header { border-bottom: 2px solid #0284c7; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; }
                        .company { font-size: 17px; font-weight: 800; }
                        .title { font-size: 13px; font-weight: 700; color: #0284c7; text-transform: uppercase; margin-top: 2px; }
                        .origin { background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #0284c7; padding: 6px 10px; border-radius: 4px; margin-bottom: 10px; font-size: 11px; }
                        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8fafc; border: 1px solid #cbd5e1; padding: 8px; border-radius: 6px; margin-bottom: 12px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
                        th { background: #0f172a; color: white; padding: 6px 8px; font-size: 10px; text-align: left; border: 1px solid #0f172a; }
                        td { padding: 6px 8px; border: 1px solid #cbd5e1; vertical-align: top; }
                        tr:nth-child(even) { background: #f8fafc; }
                        .badge { background: #10b981; color: white; font-weight: 800; padding: 2px 6px; border-radius: 10px; display: inline-block; }
                        .total-box { display: flex; justify-content: space-between; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 12px; font-weight: bold; margin-bottom: 15px; }
                        .sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 25px; }
                        .sig-line { border-top: 1px dashed #64748b; text-align: center; padding-top: 5px; font-size: 11px; }
                        @media print { button { display: none; } }
                      </style>
                    </head>
                    <body>
                      <div class="header">
                        <div>
                          <div class="company">QUÍMICA GENERAL DEHEZA</div>
                          <div class="title">📋 HOJA DE RUTA Y DESPACHO DE REPARTO</div>
                        </div>
                        <div style="text-align: right; font-size: 11px;">
                          <div><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR')}</div>
                          <div><strong>Hora:</strong> ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>

                      <div class="origin">
                        🚩 <strong>PUNTO DE ORIGEN / SALIDA:</strong> ${startPointCoords.name} (${startPointCoords.address})
                      </div>

                      <div class="grid">
                        <div>
                          <div><strong>Zona:</strong> ${zone?.name || 'General Deheza'}</div>
                          <div><strong>Chofer:</strong> ${driver?.nombre || 'Sin chofer asignado'}</div>
                        </div>
                        <div>
                          <div><strong>Total Paradas:</strong> ${stops.length} entregas</div>
                          <div><strong>Distancia / Tiempo:</strong> ${optimizedRoute.totalDistanceKm} km · ~${optimizedRoute.estimatedDurationMinutes} min</div>
                        </div>
                      </div>

                      <table>
                        <thead>
                          <tr>
                            <th style="width: 36px; text-align: center;">#</th>
                            <th style="width: 70px;">Pedido</th>
                            <th>Cliente</th>
                            <th>Domicilio de Entrega</th>
                            <th style="width: 85px; text-align: right;">Total</th>
                            <th style="width: 80px; text-align: center;">Firma</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${stops.map((s: any, idx: number) => `
                            <tr>
                              <td style="text-align: center;"><span class="badge">#${idx + 1}</span></td>
                              <td><strong>${s.numero}</strong></td>
                              <td><strong>${s.customerName}</strong></td>
                              <td>${s.formattedAddress}</td>
                              <td style="text-align: right; font-weight: bold;">$${(s.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                              <td style="height: 28px;"></td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>

                      <div class="total-box">
                        <span>TOTAL A COBRAR EN EL RECORRIDO (${stops.length} paradas):</span>
                        <span>$${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div class="sig-grid">
                        <div class="sig-line">Firma del Chofer<br/><strong>${driver?.nombre || 'Chofer'}</strong></div>
                        <div class="sig-line">Firma de Despacho<br/><strong>Química General Deheza</strong></div>
                      </div>

                      <script>window.onload = function() { window.print(); }</script>
                    </body>
                    </html>
                  `;
                  printWindow.document.open();
                  printWindow.document.write(html);
                  printWindow.document.close();
                }}
              >
                🖨️ Imprimir Hoja
              </button>
              <button className="btn btn-primary" onClick={handleSaveRoute} disabled={savingRoute}>
                {savingRoute ? 'Guardando...' : '💾 Guardar y Asignar Hoja de Ruta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
