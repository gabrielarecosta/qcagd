import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { customAlert } from '../../utils/alert';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { useAuthStore } from '../../store/authStore';
import { useOrderStore } from '../../store/orderStore';
import { formatPrice } from '../../utils/formatters';
import { routeService } from '@shared/services/routeService';
import type { GeoDeliveryRoute, DeliveryRouteStop } from '@shared/types/delivery';

export function RepartidorHomeScreen() {
  const { repartidorData, logout } = useAuthStore();
  const { orders, updateOrderStatus } = useOrderStore();
  const [driverObs, setDriverObs] = useState<Record<string, string>>({});
  const [todayRoute, setTodayRoute] = useState<GeoDeliveryRoute | null>(null);
  const [allZoneRoutes, setAllZoneRoutes] = useState<GeoDeliveryRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('my');
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Edición de perfil propio del repartidor
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Referencia para mapa web
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any | null>(null);

  // Cargar la ruta optimizada asignada al repartidor para hoy y todas las rutas activas de General Deheza
  const loadRoute = async () => {
    if (!repartidorData) return;
    setLoadingRoute(true);
    try {
      const [route, allRoutes] = await Promise.all([
        routeService.getTodayRouteForDriver(repartidorData.id),
        routeService.getAllActiveRoutesForToday(),
      ]);
      setTodayRoute(route);
      setAllZoneRoutes(allRoutes);
    } catch (e) {
      console.warn('Error al cargar rutas:', e);
    } finally {
      setLoadingRoute(false);
    }
  };

  useEffect(() => {
    loadRoute();
  }, [repartidorData]);

  // Ruta activa actualmente seleccionada
  const activeRoute = useMemo(() => {
    if (selectedRouteId === 'my') {
      return todayRoute || allZoneRoutes[0] || null;
    }
    return allZoneRoutes.find(r => r.id === selectedRouteId) || todayRoute || null;
  }, [selectedRouteId, todayRoute, allZoneRoutes]);

  // Paradas de la ruta activa ordenadas por stop_order
  const orderedStops = useMemo(() => {
    if (!activeRoute?.stops) return [];
    return [...activeRoute.stops].sort((a, b) => a.stopOrder - b.stopOrder);
  }, [activeRoute]);

  // Contadores
  const stats = useMemo(() => {
    const total = orderedStops.length;
    const completed = orderedStops.filter(s => s.status === 'entregado').length;
    const pending = orderedStops.filter(s => s.status !== 'entregado' && s.status !== 'no_entregado').length;
    const failed = orderedStops.filter(s => s.status === 'no_entregado').length;
    return { total, completed, pending, failed };
  }, [orderedStops]);

  // Referencia para marcadores del mapa
  const mapMarkersRef = useRef<any[]>([]);

  // Renderizar mapa de General Deheza con MapLibre en Web (con línea de trayecto y paradas)
  useEffect(() => {
    if (Platform.OS !== 'web' || !mapContainerRef.current) return;

    if (typeof document !== 'undefined' && !document.getElementById('maplibre-gl-css')) {
      const link = document.createElement('link');
      link.id = 'maplibre-gl-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }

    let maplibregl: any;
    try {
      maplibregl = require('maplibre-gl');
    } catch (e) {
      return;
    }


    if (!mapInstanceRef.current && mapContainerRef.current) {
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
        center: [-63.7845, -32.7561],
        zoom: 14,
      });

      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    const renderMapRoute = () => {
      // 1. Limpiar marcadores anteriores
      mapMarkersRef.current.forEach((m: any) => m.remove());
      mapMarkersRef.current = [];

      // Determinar si el punto de salida es Sucursal Central o Galpón/Depósito
      const isGalpon = activeRoute?.notes?.toLowerCase().includes('galpón') || activeRoute?.notes?.toLowerCase().includes('galpon');
      const depotLabel = isGalpon ? '🏭 GALPÓN / DEPÓSITO' : '🏬 SUCURSAL CENTRAL QGD (Entre Ríos 151)';
      const depotBg = isGalpon ? '#ea580c' : '#0f172a';

      // Coordenadas del punto de partida
      const depotCoords: [number, number] = isGalpon ? [-63.7861, -32.7566] : [-63.7860, -32.7650];
      const routeCoordinates: Array<[number, number]> = [depotCoords];

      // 2. Marcador de salida Central (Depot / Origen)
      const depotEl = document.createElement('div');
      depotEl.innerHTML = `
        <div style="background: ${depotBg}; color: white; padding: 5px 10px; border-radius: 12px; font-weight: bold; font-size: 11px; box-shadow: 0 3px 8px rgba(0,0,0,0.3); border: 2px solid white; display: flex; align-items: center; gap: 4px;">
          ${depotLabel}
        </div>
      `;
      const depotMarker = new maplibregl.Marker({ element: depotEl })
        .setLngLat(depotCoords)
        .addTo(map);
      mapMarkersRef.current.push(depotMarker);

      if (orderedStops.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        bounds.extend(depotCoords);

        orderedStops.forEach((stop, idx) => {
          // Si el pedido no tiene lat/lng en la BD, asignar coordenadas distribuidas en General Deheza
          const lat = stop.latitude && stop.latitude !== 0 ? stop.latitude : (-32.7561 + (idx + 1) * 0.0028 - 0.003);
          const lng = stop.longitude && stop.longitude !== 0 ? stop.longitude : (-63.7845 + (idx + 1) * 0.0035 - 0.005);
          const stopCoords: [number, number] = [lng, lat];
          routeCoordinates.push(stopCoords);

          const isDone = stop.status === 'entregado';
          const isFail = stop.status === 'no_entregado';
          const pinColor = isDone ? '#16a34a' : isFail ? '#dc2626' : '#10b981';

          const el = document.createElement('div');
          el.innerHTML = `
            <div style="background: ${pinColor}; color: white; width: 30px; height: 30px; border-radius: 15px; font-weight: bold; font-size: 13px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.3); border: 2px solid white; cursor: pointer;">
              #${stop.stopOrder || idx + 1}
            </div>
          `;

          const popup = new maplibregl.Popup({ offset: 15 }).setHTML(`
            <div style="padding: 6px; font-family: sans-serif;">
              <strong style="color: #0f172a; font-size: 13px;">Parada #${stop.stopOrder || idx + 1}</strong><br/>
              <span style="font-size: 12px; color: #334155; font-weight: bold;">${stop.customerName || 'Cliente'}</span><br/>
              <span style="font-size: 11px; color: #64748b;">📍 ${stop.formattedAddress || 'General Deheza'}</span><br/>
              <strong style="font-size: 12px; color: #16a34a;">Cobro: $${(stop.total || 0).toLocaleString('es-AR')}</strong>
            </div>
          `);

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(stopCoords)
            .setPopup(popup)
            .addTo(map);

          mapMarkersRef.current.push(marker);
          bounds.extend(stopCoords);
        });

        // 3. Renderizar la línea de trayecto secuenciada (Polyline idéntica al admin)
        if (routeCoordinates.length > 1) {
          const geojsonSource = {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: routeCoordinates,
            },
          };

          if (map.getSource('route-path')) {
            map.getSource('route-path').setData(geojsonSource);
          } else {
            map.addSource('route-path', {
              type: 'geojson',
              data: geojsonSource,
            });

            // Capa principal del trayecto (Verde esmeralda idéntico al admin)
            map.addLayer({
              id: 'route-path-line',
              type: 'line',
              source: 'route-path',
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#10b981',
                'line-width': 5,
                'line-opacity': 0.85,
              },
            });
          }
        }

        map.fitBounds(bounds, { padding: 40, maxZoom: 16 });
      }
    };

    if (map.isStyleLoaded()) {
      renderMapRoute();
    } else {
      map.on('load', renderMapRoute);
    }
  }, [orderedStops, activeRoute]);


  const handleSetStatus = async (orderId: string, status: any, obs?: string, stopId?: string) => {
    updateOrderStatus(orderId, status);
    if (obs) {
      setDriverObs(prev => ({ ...prev, [orderId]: obs }));
    }

    if (stopId) {
      try {
        await routeService.updateStopStatus({
          stopId,
          orderId,
          status: status === 'entregado' ? 'entregado' : status === 'en_camino' ? 'en_camino' : 'no_entregado',
          notes: obs,
        });
        loadRoute();
      } catch (e) {
        console.warn('Error al actualizar parada:', e);
      }
    }

    const statusLabel = status === 'entregado' ? 'Entregado' : status === 'en_camino' ? 'En viaje' : 'No entregado';
    customAlert('Estado Actualizado', `La parada #${orderId} fue marcada como ${statusLabel}.`);
  };

  const handleStopFailure = (orderId: string, stopId?: string) => {
    customAlert(
      'Marcar Inconveniente de Entrega',
      'Selecciona el motivo por el cual no se pudo entregar:',
      [
        { text: 'Cliente Ausente', onPress: () => handleSetStatus(orderId, 'cancelado', 'Cliente Ausente', stopId) },
        { text: 'Dirección Incorrecta', onPress: () => handleSetStatus(orderId, 'cancelado', 'Dirección Incorrecta', stopId) },
        { text: 'Rechazado por Precio', onPress: () => handleSetStatus(orderId, 'cancelado', 'Rechazado por precio', stopId) },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  const handleOpenGps = (lat?: number, lng?: number, address?: string) => {
    if (lat && lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      Linking.openURL(url).catch(() => {
        customAlert('Error', 'No se pudo abrir la aplicación de mapas.');
      });
    } else if (address) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address + ', General Deheza, Córdoba')}`;
      Linking.openURL(url).catch(() => {
        customAlert('Error', 'No se pudo abrir la aplicación de mapas.');
      });
    } else {
      customAlert('Ubicación no disponible', 'Este pedido no cuenta con coordenadas de entrega.');
    }
  };

  const handleCall = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      customAlert('Error', 'No se pudo iniciar la llamada.');
    });
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const waNumber = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
    Linking.openURL(`https://wa.me/${waNumber}?text=Hola!%20Te%20escribo%20del%20reparto%20de%20Química%20General%20Deheza.`).catch(() => {
      customAlert('Error', 'No se pudo abrir WhatsApp.');
    });
  };

  // Actualizar perfil propio
  const handleUpdateProfile = async () => {
    if (!repartidorData?.id || !profileName.trim()) return;
    setSavingProfile(true);
    try {
      const { supabase } = await import('@shared/services/supabaseClient');
      await supabase
        .from('profiles')
        .update({
          nombre: profileName.trim(),
          email: profileEmail.trim() || undefined,
        })
        .eq('id', repartidorData.id);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
      setShowEditProfile(false);
    } catch (e) {
      customAlert('Error', 'No se pudo actualizar el perfil. Intentá de nuevo.');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!repartidorData) return null;

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header Chofer */}
      <View style={[styles.header, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
        <View style={[styles.avatar, { backgroundColor: '#10b981' }]}>
          <Text style={styles.avatarText}>🚚</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.driverName}>{repartidorData.nombre}</Text>
          <Text style={styles.driverSub}>Chofer / Repartidor Oficial</Text>
          <View style={[styles.branchBadge, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.branchBadgeText, { color: '#16a34a' }]}>
              📍 Base: Química General Deheza (Entre Ríos 151)
            </Text>
          </View>
        </View>
      </View>

      {/* Resumen e Indicadores */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: Colors.primary }]}>{stats.total}</Text>
          <Text style={styles.statLabel}>Paradas Totales</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: Colors.warning }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: Colors.success }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completadas</Text>
        </View>
      </View>

      {/* ── SELECTOR DE RUTAS DEL DÍA Y ZONAS ── */}
      {allZoneRoutes.length > 0 && (
        <View style={{ paddingHorizontal: Spacing.xl, marginTop: Spacing.lg }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: 8 }}>
            🗺️ HOJAS DE RUTA DEL DÍA (GENERAL DEHEZA):
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {todayRoute && (
              <TouchableOpacity
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: Radius.full,
                  backgroundColor: selectedRouteId === 'my' ? Colors.primary : '#f1f5f9',
                  borderWidth: 1,
                  borderColor: selectedRouteId === 'my' ? Colors.primary : '#cbd5e1',
                }}
                onPress={() => setSelectedRouteId('my')}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: selectedRouteId === 'my' ? 'white' : Colors.textPrimary }}>
                  ⭐ Mi Hoja de Ruta
                </Text>
              </TouchableOpacity>
            )}

            {allZoneRoutes.map((r) => {
              const isSelected = selectedRouteId === r.id || (selectedRouteId === 'my' && todayRoute?.id === r.id);
              return (
                <TouchableOpacity
                  key={r.id}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: Radius.full,
                    backgroundColor: isSelected ? Colors.primary : '#f1f5f9',
                    borderWidth: 1,
                    borderColor: isSelected ? Colors.primary : '#cbd5e1',
                  }}
                  onPress={() => setSelectedRouteId(r.id)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: isSelected ? 'white' : Colors.textPrimary }}>
                    📍 Hoja de Ruta ({r.stops?.length || 0} paradas · {r.driverName || 'Sin chofer'})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── MAPA INTERACTIVO DE RECORRIDO EN GENERAL DEHEZA ── */}
      {orderedStops.length > 0 && (
        <View style={{ paddingHorizontal: Spacing.xl, marginTop: Spacing.lg }}>
          <View style={{ backgroundColor: 'white', borderRadius: Radius.lg, borderWidth: 1, borderColor: '#cbd5e1', overflow: 'hidden' }}>
            <View style={{ padding: Spacing.md, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#0f172a' }}>
                  🗺️ Mapa de Recorrido: General Deheza
                </Text>
                <Text style={{ fontSize: 11, color: '#64748b' }}>
                  Paradas secuenciadas del #1 al #{orderedStops.length} partiendo de Entre Ríos 151
                </Text>
              </View>
              {activeRoute && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Text style={{ backgroundColor: '#dcfce7', color: '#16a34a', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>
                    🛣️ {activeRoute.totalDistance} km
                  </Text>
                  <Text style={{ backgroundColor: '#e0f2fe', color: '#0284c7', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, fontSize: 11, fontWeight: 'bold' }}>
                    ⏱️ ~{activeRoute.estimatedDuration} min
                  </Text>
                </View>
              )}
            </View>

            {Platform.OS === 'web' ? (
              <div ref={mapContainerRef} style={{ width: '100%', height: '260px' }} />
            ) : (
              <View style={{ height: 160, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', padding: Spacing.md }}>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#334155' }}>
                  📍 {orderedStops.length} Paradas Planificadas en General Deheza
                </Text>
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4, textAlign: 'center' }}>
                  Seguí el orden #1, #2, #3... en el listado a continuación para optimizar el recorrido.
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── LISTADO DE PARADAS SECUENCIADAS ── */}
      <View style={styles.section}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md }}>
          <Text style={styles.sectionTitle}>
            Secuencia de Paradas ({orderedStops.length})
          </Text>
          <TouchableOpacity onPress={loadRoute} style={styles.refreshBtn} activeOpacity={0.7}>
            <Text style={styles.refreshBtnText}>🔄 Actualizar</Text>
          </TouchableOpacity>
        </View>

        {orderedStops.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>Sin hoja de ruta asignada</Text>
            <Text style={styles.emptySub}>No tenés entregas pendientes asignadas en tu hoja de ruta por el momento.</Text>
          </View>
        ) : (
          orderedStops.map((stop) => {
            const isCompleted = stop.status === 'entregado';
            const isFailed = stop.status === 'no_entregado';
            const isEnCamino = stop.status === 'en_camino' || stop.status === 'en_reparto';

            return (
              <View
                key={stop.id || stop.orderId}
                style={[
                  styles.orderCard,
                  isCompleted && styles.orderCardCompleted,
                  isFailed && styles.orderCardFailed,
                ]}
              >
                {/* Header de la parada */}
                <View style={styles.orderCardHeader}>
                  <View style={[styles.stopBadge, isCompleted && { backgroundColor: '#16a34a' }, isFailed && { backgroundColor: '#dc2626' }]}>
                    <Text style={styles.stopBadgeText}>#{stop.stopOrder}</Text>
                  </View>
                  <View style={styles.orderNumberCol}>
                    <Text style={styles.orderNumberText}>{stop.orderNumber || `Pedido #${String(stop.orderId).slice(-5)}`}</Text>
                    <Text style={styles.customerName}>{stop.customerName || 'Cliente'}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      isCompleted && { backgroundColor: '#dcfce7' },
                      isFailed && { backgroundColor: '#fee2e2' },
                      isEnCamino && { backgroundColor: '#e0f2fe' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isCompleted && { color: '#16a34a' },
                        isFailed && { color: '#dc2626' },
                        isEnCamino && { color: '#0284c7' },
                      ]}
                    >
                      {(stop.status || 'pendiente').toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Domicilio y Navegación GPS */}
                <View style={styles.addressBox}>
                  <Text style={styles.addressLabel}>Domicilio de Entrega:</Text>
                  <Text style={styles.addressText}>{stop.formattedAddress || stop.originalAddress || 'General Deheza'}</Text>

                  {/* Botón de Navegación GPS */}
                  <TouchableOpacity
                    style={styles.gpsButton}
                    onPress={() => handleOpenGps(stop.latitude, stop.longitude, stop.formattedAddress)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.gpsButtonText}>📍 Iniciar Navegación GPS (Google Maps / Waze)</Text>
                  </TouchableOpacity>
                </View>

                {/* Contacto con el Cliente */}
                {stop.customerPhone ? (
                  <View style={styles.contactRow}>
                    <TouchableOpacity
                      style={[styles.contactButton, { backgroundColor: '#dcfce7' }]}
                      onPress={() => handleWhatsApp(stop.customerPhone!)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.contactButtonText, { color: '#16a34a' }]}>💬 WhatsApp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.contactButton, { backgroundColor: '#eff6ff' }]}
                      onPress={() => handleCall(stop.customerPhone!)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.contactButtonText, { color: '#2563eb' }]}>📞 Llamar</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {/* Total y Pago */}
                <View style={styles.paymentInfoRow}>
                  <View>
                    <Text style={styles.paymentLabel}>Total a cobrar:</Text>
                    <Text style={styles.paymentAmount}>{formatPrice(stop.total || 0)}</Text>
                  </View>
                </View>

                {/* Botones de Acción para el Chofer */}
                {!isCompleted && (
                  <View style={styles.actionButtonsRow}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#dc2626' }]}
                      onPress={() => handleStopFailure(stop.orderId, stop.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionBtnText}>⚠️ No Entregado</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: '#16a34a', flex: 1.5 }]}
                      onPress={() => handleSetStatus(stop.orderId, 'entregado', undefined, stop.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionBtnText}>✅ Confirmar Entrega</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* ── TARJETA DE PERFIL EDITABLE ── */}
      <View style={{ paddingHorizontal: 16, marginTop: 20, marginBottom: 8 }}>
        {!showEditProfile ? (
          <TouchableOpacity
            onPress={() => {
              setProfileName(repartidorData.nombre || '');
              setProfileEmail(repartidorData.email || '');
              setShowEditProfile(true);
            }}
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              shadowColor: '#000',
              shadowOpacity: 0.04,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>👤 Mi Perfil</Text>
              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                Nombre: <Text style={{ fontWeight: '600', color: '#334155' }}>{repartidorData.nombre}</Text>
              </Text>
              {repartidorData.email ? (
                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>📧 {repartidorData.email}</Text>
              ) : (
                <Text style={{ fontSize: 11, color: '#f59e0b', marginTop: 1 }}>⚠️ Sin email configurado</Text>
              )}
              {profileSaved && (
                <Text style={{ fontSize: 11, color: '#16a34a', marginTop: 2, fontWeight: '600' }}>✅ Perfil guardado</Text>
              )}
            </View>
            <Text style={{ fontSize: 18, color: '#94a3b8' }}>✏️</Text>
          </TouchableOpacity>
        ) : (
          <View
            style={{
              backgroundColor: 'white',
              borderRadius: 12,
              padding: 16,
              borderWidth: 1,
              borderColor: '#3b82f6',
              shadowColor: '#3b82f6',
              shadowOpacity: 0.08,
              shadowRadius: 6,
              elevation: 3,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 12 }}>✏️ Editar Mi Perfil</Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Nombre completo:</Text>
            <TextInput
              value={profileName}
              onChangeText={setProfileName}
              placeholder="Tu nombre completo"
              style={{
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                fontSize: 14,
                color: '#0f172a',
                backgroundColor: '#f8fafc',
                marginBottom: 10,
              }}
            />

            <Text style={{ fontSize: 12, fontWeight: '600', color: '#475569', marginBottom: 4 }}>Email (para iniciar sesión):</Text>
            <TextInput
              value={profileEmail}
              onChangeText={setProfileEmail}
              placeholder="tu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                borderWidth: 1,
                borderColor: '#cbd5e1',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                fontSize: 14,
                color: '#0f172a',
                backgroundColor: '#f8fafc',
                marginBottom: 14,
              }}
            />

            <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 10, lineHeight: 16 }}>
              ℹ️ El email que configures será el que uses para ingresar a la app. Si lo cambiás, la próxima vez iniciá sesión con el nuevo email.
            </Text>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setShowEditProfile(false)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: '#f1f5f9',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748b' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpdateProfile}
                disabled={savingProfile || !profileName.trim()}
                style={{
                  flex: 2,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: savingProfile ? '#93c5fd' : '#2563eb',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>
                  {savingProfile ? 'Guardando...' : '💾 Guardar Cambios'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: '#f8fafc' },
  content: { paddingBottom: 60 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: { fontSize: 24 },
  headerInfo: { flex: 1 },
  driverName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  driverSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  branchBadge: { marginTop: 4, alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 6, borderRadius: Radius.sm },
  branchBadgeText: { fontSize: 11, fontWeight: FontWeight.semibold },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  statNumber: { fontSize: 20, fontWeight: FontWeight.bold },
  statLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  section: { paddingHorizontal: Spacing.xl, marginTop: Spacing.xl },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  refreshBtn: { paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#f1f5f9', borderRadius: Radius.sm },
  refreshBtnText: { fontSize: 12, color: Colors.textSecondary, fontWeight: FontWeight.semibold },
  emptyCard: { backgroundColor: 'white', padding: Spacing.xxl, borderRadius: Radius.lg, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  emptyIcon: { fontSize: 40, marginBottom: Spacing.sm },
  emptyTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  emptySub: { fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'center', marginTop: 4 },
  orderCard: {
    backgroundColor: 'white',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: Spacing.md,
  },
  orderCardCompleted: { borderColor: '#86efac', backgroundColor: '#f0fdf4' },
  orderCardFailed: { borderColor: '#fca5a5', backgroundColor: '#fef2f2' },
  orderCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  stopBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.sm },
  stopBadgeText: { color: 'white', fontWeight: FontWeight.bold, fontSize: 13 },
  orderNumberCol: { flex: 1 },
  orderNumberText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  customerName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: Colors.textPrimary },
  statusBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: Radius.full, backgroundColor: '#f1f5f9' },
  statusBadgeText: { fontSize: 10, fontWeight: FontWeight.bold, color: Colors.textSecondary },
  addressBox: { backgroundColor: '#f8fafc', padding: Spacing.sm, borderRadius: Radius.md, marginTop: Spacing.xs, borderWidth: 1, borderColor: '#f1f5f9' },
  addressLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: FontWeight.bold },
  addressText: { fontSize: 12, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: 2 },
  gpsButton: { marginTop: 8, backgroundColor: '#0284c7', paddingVertical: 6, paddingHorizontal: 10, borderRadius: Radius.sm, alignItems: 'center' },
  gpsButtonText: { color: 'white', fontSize: 11, fontWeight: FontWeight.bold },
  contactRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  contactButton: { flex: 1, paddingVertical: 6, borderRadius: Radius.sm, alignItems: 'center' },
  contactButtonText: { fontSize: 12, fontWeight: FontWeight.bold },
  paymentInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm, paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  paymentLabel: { fontSize: 11, color: Colors.textSecondary },
  paymentAmount: { fontSize: 14, fontWeight: FontWeight.bold, color: Colors.primary },
  actionButtonsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: Radius.md, alignItems: 'center' },
  actionBtnText: { color: 'white', fontWeight: FontWeight.bold, fontSize: 12 },
});
