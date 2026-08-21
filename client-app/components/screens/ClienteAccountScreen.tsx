import React, { useMemo, useState, useEffect, useRef } from 'react';

import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  TextInput,
  Platform,
} from 'react-native';
import { customAlert } from '../../utils/alert';
import { companySettingsService } from '@shared/services/companySettingsService';
import { clientService } from '@shared/services/clientService';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { useAuthStore } from '../../store/authStore';
import { useOrderStore } from '../../store/orderStore';
import { useCartStore } from '../../store/cartStore';
import { formatPrice } from '../../utils/formatters';
import { Order, CustomerAddress } from '../../types';
import { OrderCard } from '../OrderCard';
import { OrderDetailModal } from '../OrderDetailModal';
import { AppFooter } from '../AppFooter';
import { suggestDehezaStreets, StreetSuggestion } from '@shared/utils/dehezaStreets';
import { geocodeAddress } from '@shared/utils/geo';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={infoStyles.value}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.lg,
  },
  label: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flex: 2,
    textAlign: 'right',
  },
});

export function ClienteAccountScreen() {
  const router = useRouter();
  const { clientData, logout, setClienteSession } = useAuthStore();
  const { orders, fetchOrders } = useOrderStore();
  const { repeatOrder } = useCartStore();

  const [companySettings, setCompanySettings] = useState<any>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDireccion, setNewDireccion] = useState('');
  const [newIndicaciones, setNewIndicaciones] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);
  const [deliveryMethodFilter, setDeliveryMethodFilter] = useState<'all' | 'reparto' | 'retiro' | 'whatsapp'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'preparacion' | 'en_camino' | 'entregado' | 'cancelado'>('all');

  // Coordenadas y mapa para agregar dirección
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [newLat, setNewLat] = useState(-32.7561);
  const [newLng, setNewLng] = useState(-63.7845);

  const loadAddresses = async () => {
    if (!clientData) return;
    setLoadingAddresses(true);
    try {
      const list = await clientService.getAddresses(clientData.id);
      setAddresses(list);
    } catch (e) {
      console.warn('Error loading addresses:', e);
    } finally {
      setLoadingAddresses(false);
    }
  };

  // Garantizar que la dirección de registro principal NUNCA se borre
  const combinedAddresses = useMemo(() => {
    if (!clientData) return addresses;
    
    // Verificar si la dirección de registro ya está guardada en customer_addresses
    const hasOriginal = addresses.some(a => 
      a.direccion && clientData.direccion && 
      a.direccion.toLowerCase().trim() === clientData.direccion.toLowerCase().trim()
    );

    if (!hasOriginal && clientData.direccion) {
      const originalVirtualAddress: CustomerAddress = {
        id: `main-${clientData.id}`,
        customerId: clientData.id,
        direccion: clientData.direccion,
        indicaciones: 'Domicilio principal de registro',
        latitude: clientData.latitude || -32.7561,
        longitude: clientData.longitude || -63.7845,
        locationVerified: clientData.locationVerified || false,
        defaultAddress: true,
      };
      return [originalVirtualAddress, ...addresses];
    }

    return addresses;
  }, [addresses, clientData]);

  // Inicializar mapa de OpenStreetMap (Leaflet) en Web al abrir formulario de agregar dirección
  useEffect(() => {
    if (Platform.OS !== 'web' || !showAddForm) {
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch (_) {}
        mapInstanceRef.current = null;
      }
      return;
    }

    // Inyectar CSS de Leaflet para Web
    if (typeof document !== 'undefined' && !document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Inyectar Script de Leaflet para Web
    if (typeof document !== 'undefined' && !document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      document.head.appendChild(script);
    }

    let attempts = 0;
    const maxAttempts = 25;
    let timerId: any = null;

    const initMap = () => {
      attempts++;
      const targetContainer = document.getElementById('client-account-map-container') || mapContainerRef.current;
      const L = typeof window !== 'undefined' ? (window as any).L : null;

      if (!targetContainer || !L) {
        if (attempts < maxAttempts) {
          timerId = setTimeout(initMap, 150);
        }
        return;
      }

      // Si ya existía un mapa previo, destruirlo limpiamente primero
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch (_) {}
        mapInstanceRef.current = null;
      }

      try {
        const map = L.map(targetContainer).setView([newLat, newLng], 15);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap | Química General Deheza',
        }).addTo(map);

        const marker = L.marker([newLat, newLng], { draggable: true }).addTo(map);
        markerRef.current = marker;

        const triggerResize = () => {
          try {
            map.invalidateSize();
          } catch (_) {}
        };

        setTimeout(triggerResize, 100);
        setTimeout(triggerResize, 300);
        setTimeout(triggerResize, 600);

        const processMapLocation = async (lat: number, lng: number) => {
          setNewLat(lat);
          setNewLng(lng);
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`, {
              headers: { 'User-Agent': 'QuimicaGeneralDeheza-ClientApp/1.0' },
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.display_name) {
                setNewDireccion(data.display_name);
              }
            }
          } catch (_) {}
        };

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          processMapLocation(pos.lat, pos.lng);
        });

        map.on('click', (e: any) => {
          marker.setLatLng(e.latlng);
          processMapLocation(e.latlng.lat, e.latlng.lng);
        });

        mapInstanceRef.current = map;
      } catch (err) {
        console.error('Error instantiating Leaflet map:', err);
      }
    };

    timerId = setTimeout(initMap, 100);

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [showAddForm]);




  const handleSearchAddressInMap = async (addressToSearch?: string) => {
    const query = addressToSearch || newDireccion;
    if (!query.trim()) return;

    try {
      const geoResult = await geocodeAddress(query, 'General Deheza', 'Córdoba');
      if (geoResult) {
        setNewLat(geoResult.latitude);
        setNewLng(geoResult.longitude);
        if (geoResult.formattedAddress) {
          setNewDireccion(geoResult.formattedAddress);
        }
        if (mapInstanceRef.current && markerRef.current) {
          if (mapInstanceRef.current.setView) {
            mapInstanceRef.current.setView([geoResult.latitude, geoResult.longitude], 16);
          } else if (mapInstanceRef.current.flyTo) {
            mapInstanceRef.current.flyTo({ center: [geoResult.longitude, geoResult.latitude], zoom: 16 });
          }
          if (markerRef.current.setLatLng) {
            markerRef.current.setLatLng([geoResult.latitude, geoResult.longitude]);
          } else if (markerRef.current.setLngLat) {
            markerRef.current.setLngLat([geoResult.longitude, geoResult.latitude]);
          }
        }
      }
    } catch (e) {
      console.warn('Geocoding error:', e);
    }
  };

  const dehezaStreetSuggestions = useMemo(() => {
    if (!newDireccion || newDireccion.trim().length < 2) return [];
    return suggestDehezaStreets(newDireccion, 3);
  }, [newDireccion]);

  const handleSelectStreetSuggestion = (sug: StreetSuggestion) => {
    setNewDireccion(sug.fullAddress);
    handleSearchAddressInMap(sug.fullAddress);
  };

  const handleSaveAddress = async () => {
    if (!clientData || !newDireccion.trim()) return;
    setSavingAddress(true);
    try {
      let lat = newLat;
      let lon = newLng;
      let verified = true;

      // Si no ha tocado el mapa pero tipeó la dirección, geocodificar por defecto
      if (lat === -32.7561 && lon === -63.7845) {
        try {
          const geoResult = await geocodeAddress(newDireccion, 'General Deheza', 'Córdoba');
          if (geoResult) {
            lat = geoResult.latitude;
            lon = geoResult.longitude;
          }
        } catch (e) {
          console.warn('Geocoding fallback:', e);
        }
      }

      const isFirstAddress = addresses.length === 0;

      await clientService.addAddress({
        customerId: clientData.id,
        direccion: newDireccion,
        indicaciones: newIndicaciones || undefined,
        latitude: lat,
        longitude: lon,
        locationVerified: verified,
        defaultAddress: isFirstAddress,
      });

      if (isFirstAddress) {
        try {
          await clientService.update(clientData.id, {
            direccion: newDireccion,
            latitude: lat,
            longitude: lon,
            locationVerified: verified,
          });
          setClienteSession({
            ...clientData,
            direccion: newDireccion,
            latitude: lat,
            longitude: lon,
            locationVerified: verified,
          });
        } catch (updateErr) {
          console.warn('Error al actualizar dirección principal en perfil:', updateErr);
        }
      }

      await loadAddresses();
      setNewDireccion('');
      setNewIndicaciones('');
      setShowAddForm(false);
      customAlert('Éxito', 'Dirección de envío agregada correctamente.');
    } catch (e) {
      console.error(e);
      customAlert('Error', 'No se pudo agregar la dirección.');
    } finally {
      setSavingAddress(false);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await companySettingsService.get();
      setCompanySettings(settings);
    };
    loadSettings();
    loadAddresses();
    // Fix bug: fetch orders on mount so they appear without visiting the reparto screen
    if (clientData?.id) {
      fetchOrders(clientData.id);
    }
  }, [clientData]);

  const clientOrders = useMemo(() => {
    if (!clientData) return [];
    return orders.filter(o => o.clienteId === clientData.id);
  }, [orders, clientData]);

  // Contadores para chips de método de entrega
  const deliveryCounts = useMemo(() => {
    const total = clientOrders.length;
    const reparto = clientOrders.filter(o => o.deliveryMethod === 'reparto' || !o.deliveryMethod).length;
    const retiro = clientOrders.filter(o => o.deliveryMethod === 'retiro').length;
    const whatsapp = clientOrders.filter(o => o.deliveryMethod === 'whatsapp').length;
    return { total, reparto, retiro, whatsapp };
  }, [clientOrders]);

  // Contadores para chips de estados
  const statusCounts = useMemo(() => {
    const total = clientOrders.length;
    const preparacion = clientOrders.filter(o => o.estado === 'pendiente' || o.estado === 'recibido' || o.estado === 'en_preparacion' || o.estado === 'listo_para_reparto').length;
    const en_camino = clientOrders.filter(o => o.estado === 'en_camino' || o.estado === 'en_reparto').length;
    const entregado = clientOrders.filter(o => o.estado === 'entregado').length;
    const cancelado = clientOrders.filter(o => (o.estado as string) === 'cancelado' || (o.estado as string) === 'reprogramado').length;
    return { total, preparacion, en_camino, entregado, cancelado };
  }, [clientOrders]);

  // Pedidos filtrados según selección de chips
  const filteredClientOrders = useMemo(() => {
    return clientOrders.filter((o) => {
      // Filtro por método de entrega
      const matchesDelivery =
        deliveryMethodFilter === 'all'
          ? true
          : deliveryMethodFilter === 'reparto'
          ? o.deliveryMethod === 'reparto' || !o.deliveryMethod
          : o.deliveryMethod === deliveryMethodFilter;

      // Filtro por estado
      let matchesStatus = true;
      if (statusFilter === 'preparacion') {
        matchesStatus = o.estado === 'pendiente' || o.estado === 'recibido' || o.estado === 'en_preparacion' || o.estado === 'listo_para_reparto';
      } else if (statusFilter === 'en_camino') {
        matchesStatus = o.estado === 'en_camino' || o.estado === 'en_reparto';
      } else if (statusFilter === 'entregado') {
        matchesStatus = o.estado === 'entregado';
      } else if (statusFilter === 'cancelado') {
        matchesStatus = (o.estado as string) === 'cancelado' || (o.estado as string) === 'reprogramado';
      }

      return matchesDelivery && matchesStatus;
    });
  }, [clientOrders, deliveryMethodFilter, statusFilter]);

  // Encontrar el último pedido
  const lastOrder = useMemo(() => {
    if (clientOrders.length === 0) return null;
    // Ordenar por fecha descendente
    return [...clientOrders].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
  }, [clientOrders]);

  // Obtener productos más frecuentes basados en pedidos mock
  const frequentProductsList = useMemo(() => {
    const counts: Record<string, { name: string; count: number }> = {};
    clientOrders.forEach((order) => {
      order.items.forEach((item) => {
        if (counts[item.producto.id]) {
          counts[item.producto.id].count += item.cantidad;
        } else {
          counts[item.producto.id] = {
            name: item.producto.nombre,
            count: item.cantidad,
          };
        }
      });
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [clientOrders]);

  const handleRepeatOrder = (order: Order) => {
    repeatOrder(order);
    customAlert('Pedido cargado', 'Los artículos de ese pedido se agregaron a tu Carrito.');
    router.push('/(tabs)/carrito');
  };

  const handleCallSupport = () => {
    const tel = companySettings?.telefono || '3584123456';
    Linking.openURL(`tel:${tel}`);
  };

  const handleWhatsappSupport = () => {
    const wa = companySettings?.whatsapp || '5493511234567';
    Linking.openURL(`https://wa.me/${wa}?text=Hola!%20Necesito%20ayuda%20con%20mi%20pedido%20de%20Quimica.`);
  };

  if (!clientData) return null;

  const initials = clientData.nombre
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header Perfil */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.customerName}>{clientData.nombre}</Text>
          {!!clientData.razonSocial && (
            <Text style={styles.razonSocial}>{clientData.razonSocial}</Text>
          )}
        </View>
      </View>

      {/* Mis Datos */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mis datos</Text>
        <InfoRow label="Razón Social" value={clientData.razonSocial || clientData.nombre} />
        <InfoRow label="CUIT / DNI" value={clientData.cuit || '-'} />
        <InfoRow label="Teléfono" value={clientData.telefono} />
        <InfoRow label="Email" value={clientData.email || '-'} />
        <InfoRow label="Tipo de Cliente" value={clientData.tipoCliente === 'mayorista' ? 'Mayorista' : clientData.tipoCliente === 'sucursal' ? 'Sucursal' : 'Consumidor Final'} />
      </View>

      {/* Direcciones de Entrega */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Direcciones de entrega</Text>
        
        {combinedAddresses.map((addr) => (
          <View key={addr.id} style={[styles.addressBox, addr.defaultAddress && { borderColor: Colors.primary, borderWidth: 1.5 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={styles.addressTitle}>
                {addr.defaultAddress ? '🏠 Dirección Principal' : '📍 Dirección Auxiliar'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {!addr.defaultAddress && (
                  <TouchableOpacity
                    onPress={async () => {
                      await clientService.setDefaultAddress(clientData.id, addr.id!);
                      await loadAddresses();
                      customAlert('Principal', 'Establecida como dirección principal.');
                    }}
                  >
                    <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: 'bold' }}>Principal</Text>
                  </TouchableOpacity>
                )}
                {addr.id && !String(addr.id).startsWith('main-') && (
                  <TouchableOpacity
                    onPress={async () => {
                      await clientService.deleteAddress(String(addr.id));
                      await loadAddresses();
                      customAlert('Eliminada', 'Dirección eliminada correctamente.');
                    }}
                  >
                    <Text style={{ fontSize: 13, color: Colors.danger, fontWeight: 'bold' }}>Eliminar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <Text style={styles.addressText}>{addr.direccion}</Text>
            {addr.indicaciones ? (
              <Text style={{ fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 }}>
                ℹ️ {addr.indicaciones}
              </Text>
            ) : null}
          </View>
        ))}

        {!showAddForm ? (
          <TouchableOpacity 
            style={[styles.repeatBtn, { backgroundColor: '#f1f5f9', marginTop: Spacing.md, height: 46 }]} 
            onPress={() => setShowAddForm(true)}
          >
            <Text style={{ color: Colors.textPrimary, fontWeight: 'bold', fontSize: FontSize.md }}>
              ➕ Agregar Nueva Dirección
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ marginTop: Spacing.md, padding: Spacing.md, backgroundColor: '#f8fafc', borderRadius: Radius.md, borderWidth: 1, borderColor: '#e2e8f0' }}>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: Colors.textPrimary, marginBottom: Spacing.md }}>
              Nueva Dirección de Entrega
            </Text>

            <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>Dirección (Calle, Altura, Localidad)</Text>
            <View style={{ backgroundColor: 'white', borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8, marginBottom: dehezaStreetSuggestions.length > 0 ? 6 : Spacing.sm, flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                placeholder="Ej: Bv. San Martín 456, General Deheza"
                value={newDireccion}
                onChangeText={setNewDireccion}
                style={{ flex: 1, fontSize: 14, color: Colors.textPrimary, padding: 0 }}
              />
              {!!newDireccion && (
                <TouchableOpacity
                  onPress={() => setNewDireccion('')}
                  style={{ paddingHorizontal: 7, paddingVertical: 2, backgroundColor: '#f1f5f9', borderRadius: 12, marginLeft: 6 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 12, color: '#64748b', fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: '#2563eb',
                borderRadius: Radius.sm,
                alignItems: 'center',
                marginBottom: Spacing.md,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6
              }}
              onPress={() => handleSearchAddressInMap()}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>
                🔍 Buscar "{newDireccion || 'Dirección'}" en el Mapa
              </Text>
            </TouchableOpacity>

            {/* Sugerencias de calles de General Deheza */}
            {dehezaStreetSuggestions.length > 0 && (
              <View style={{ marginBottom: Spacing.md, backgroundColor: '#eff6ff', borderRadius: Radius.sm, padding: 8, borderWidth: 1, borderColor: '#bfdbfe' }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1e40af', marginBottom: 4 }}>
                  💡 Calles sugeridas de General Deheza:
                </Text>
                {dehezaStreetSuggestions.map((sug) => (
                  <TouchableOpacity
                    key={sug.street.name}
                    style={{ paddingVertical: 5, paddingHorizontal: 8, borderRadius: 4, backgroundColor: 'white', marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0' }}
                    onPress={() => handleSelectStreetSuggestion(sug)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '600', color: Colors.textPrimary }}>
                      📍 {sug.fullAddress}
                    </Text>
                    {sug.street.zoneHint && (
                      <Text style={{ fontSize: 10, color: Colors.primary, fontWeight: 'bold' }}>
                        Zona {sug.street.zoneHint}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Mapa interactivo de MapLibre en Web */}
            {Platform.OS === 'web' && (
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>
                  📍 Ubicación en el Mapa (Clic o arrastrá el pin para ajustar punto exacto):
                </Text>
                <div
                  id="client-account-map-container"
                  ref={mapContainerRef}
                  style={{
                    width: '100%',
                    height: '240px',
                    minHeight: '240px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid #cbd5e1',
                    position: 'relative'
                  }}
                />
              </View>
            )}


            <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>Indicaciones / Referencia (Opcional)</Text>
            <View style={{ backgroundColor: 'white', borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8, marginBottom: Spacing.lg }}>
              <TextInput
                placeholder="Ej: Portón de rejas negras, timbre blanco"
                value={newIndicaciones}
                onChangeText={setNewIndicaciones}
                style={{ fontSize: 14, color: Colors.textPrimary, padding: 0 }}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, height: 44, backgroundColor: Colors.primary, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' }}
                onPress={handleSaveAddress}
                disabled={savingAddress}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                  {savingAddress ? 'Guardando...' : 'Guardar'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, height: 44, backgroundColor: '#e2e8f0', borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setShowAddForm(false)}
              >
                <Text style={{ color: Colors.textSecondary, fontWeight: 'bold', fontSize: 14 }}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>

      {/* Estado del Reparto (Tracking) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estado de mi reparto</Text>
        <Text style={styles.cardDesc}>Consultá en tiempo real si tu pedido está en camino y el chofer asignado.</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/reparto')}>
          <Text style={styles.menuItemIcon}>🚚</Text>
          <Text style={styles.menuItemLabel}>Ver el seguimiento del reparto</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Métodos de Pago */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Métodos de pago</Text>
        <Text style={styles.cardDesc}>Podés abonar tus compras usando cualquiera de estos métodos:</Text>
        <View style={styles.paymentMethodRow}>
          <Text style={styles.paymentIcon}>💵</Text>
          <View style={styles.paymentTextCol}>
            <Text style={styles.paymentMethodTitle}>Efectivo contra entrega</Text>
            <Text style={styles.paymentMethodDesc}>Pagás al recibir. Te llevamos el vuelto exacto.</Text>
          </View>
        </View>
        <View style={styles.paymentMethodRow}>
          <Text style={styles.paymentIcon}>💳</Text>
          <View style={styles.paymentTextCol}>
            <Text style={styles.paymentMethodTitle}>Mercado Pago</Text>
            <Text style={styles.paymentMethodDesc}>Pagar con tarjetas de crédito, débito o dinero en cuenta de MP.</Text>
          </View>
        </View>
      </View>

      {/* Repetir último pedido */}
      {lastOrder && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Repetir último pedido</Text>
          <View style={styles.orderSummaryBox}>
            <Text style={styles.orderSummaryTitle}>Pedido #{lastOrder.numero}</Text>
            <Text style={styles.orderSummaryDate}>
              Fecha: {new Date(lastOrder.fecha).toLocaleDateString()} a las {new Date(lastOrder.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
            </Text>
            {!!lastOrder.deliveryDate && (
              <Text style={[styles.orderSummaryDate, { color: Colors.primary, fontWeight: '600', marginTop: 2 }]}>
                🚚 Entrega: {lastOrder.deliveryDate} de {lastOrder.deliveryStartTime} a {lastOrder.deliveryEndTime} hs
              </Text>
            )}
            <Text style={styles.orderSummaryPrice}>Total: {formatPrice(lastOrder.total)}</Text>
            <TouchableOpacity style={styles.repeatBtn} onPress={() => handleRepeatOrder(lastOrder)} activeOpacity={0.8}>
              <Text style={styles.repeatBtnText}>🛒 Repetir esta compra</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}


      {/* Productos frecuentes */}
      {frequentProductsList.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Productos frecuentes</Text>
          <Text style={styles.cardDesc}>Artículos que comprás habitualmente:</Text>
          {frequentProductsList.map((prod, idx) => (
            <View key={idx} style={styles.frequentItem}>
              <Text style={styles.frequentItemBullet}>🔹</Text>
              <Text style={styles.frequentItemText}>{prod.name}</Text>
            </View>
          ))}
          <TouchableOpacity 
            style={[styles.repeatBtn, { backgroundColor: Colors.primaryLight, marginTop: Spacing.md }]} 
            onPress={() => router.push('/(tabs)/catalogo')}
            activeOpacity={0.8}
          >
            <Text style={[styles.repeatBtnText, { color: Colors.primary }]}>Ir al catálogo de productos</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Mis Pedidos Historial */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Historial de pedidos ({clientOrders.length})</Text>

        {clientOrders.length > 0 && (
          <View style={{ marginBottom: Spacing.lg, gap: 12 }}>
            {/* Chips de filtro por Tipo de Entrega */}
            <View>
              <Text style={styles.filterSectionHeader}>
                Tipo de entrega
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    deliveryMethodFilter === 'all' && styles.filterChipActive
                  ]}
                  onPress={() => setDeliveryMethodFilter('all')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, deliveryMethodFilter === 'all' && styles.filterChipTextActive]}>
                    Todos ({deliveryCounts.total})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    deliveryMethodFilter === 'reparto' && styles.filterChipActive
                  ]}
                  onPress={() => setDeliveryMethodFilter('reparto')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, deliveryMethodFilter === 'reparto' && styles.filterChipTextActive]}>
                    🚚 Repartos ({deliveryCounts.reparto})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    deliveryMethodFilter === 'retiro' && styles.filterChipActive
                  ]}
                  onPress={() => setDeliveryMethodFilter('retiro')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, deliveryMethodFilter === 'retiro' && styles.filterChipTextActive]}>
                    🏪 Retiros ({deliveryCounts.retiro})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    deliveryMethodFilter === 'whatsapp' && styles.filterChipActive
                  ]}
                  onPress={() => setDeliveryMethodFilter('whatsapp')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, deliveryMethodFilter === 'whatsapp' && styles.filterChipTextActive]}>
                    💬 Coordinados ({deliveryCounts.whatsapp})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* Chips de filtro por Estado */}
            <View>
              <Text style={styles.filterSectionHeader}>
                Estado del pedido
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    statusFilter === 'all' && styles.filterChipActive
                  ]}
                  onPress={() => setStatusFilter('all')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, statusFilter === 'all' && styles.filterChipTextActive]}>
                    Todos ({statusCounts.total})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    statusFilter === 'preparacion' && styles.filterChipActive
                  ]}
                  onPress={() => setStatusFilter('preparacion')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, statusFilter === 'preparacion' && styles.filterChipTextActive]}>
                    📦 En preparación ({statusCounts.preparacion})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    statusFilter === 'en_camino' && styles.filterChipActive
                  ]}
                  onPress={() => setStatusFilter('en_camino')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, statusFilter === 'en_camino' && styles.filterChipTextActive]}>
                    🚚 En camino ({statusCounts.en_camino})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    statusFilter === 'entregado' && styles.filterChipActive
                  ]}
                  onPress={() => setStatusFilter('entregado')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, statusFilter === 'entregado' && styles.filterChipTextActive]}>
                    ✅ Entregados ({statusCounts.entregado})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    statusFilter === 'cancelado' && styles.filterChipActive
                  ]}
                  onPress={() => setStatusFilter('cancelado')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterChipText, statusFilter === 'cancelado' && styles.filterChipTextActive]}>
                    ❌ Cancelados ({statusCounts.cancelado})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        )}

        {clientOrders.length === 0 ? (
          <Text style={styles.emptyText}>No tenés pedidos registrados todavía.</Text>
        ) : filteredClientOrders.length === 0 ? (
          <View style={styles.noResultsCard}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>🔍</Text>
            <Text style={styles.noResultsTitle}>
              Sin pedidos para los filtros seleccionados
            </Text>
            <Text style={styles.noResultsSub}>
              Probá cambiando el tipo de entrega o el estado seleccionado.
            </Text>
            <TouchableOpacity
              style={styles.resetFiltersBtn}
              onPress={() => {
                setDeliveryMethodFilter('all');
                setStatusFilter('all');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.resetFiltersBtnText}>Restablecer filtros</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: Spacing.md }}>
            {filteredClientOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onPress={(order) => setSelectedOrderForModal(order)}
                onRepeat={handleRepeatOrder}
              />
            ))}
          </View>
        )}
      </View>

      {/* Contacto y Soporte */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>¿Necesitás ayuda?</Text>
        <TouchableOpacity style={styles.menuItem} onPress={handleWhatsappSupport}>
          <Text style={styles.menuItemIcon}>💬</Text>
          <Text style={styles.menuItemLabel}>Contactar por WhatsApp</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleCallSupport}>
          <Text style={styles.menuItemIcon}>📞</Text>
          <Text style={styles.menuItemLabel}>Llamar por teléfono</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </TouchableOpacity>

        {!!companySettings?.direccion && (
          <View style={[styles.menuItem, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <Text style={styles.menuItemIcon}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.md, color: Colors.textSecondary }}>Nuestra Dirección</Text>
              <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: 2 }}>{companySettings.direccion}</Text>
            </View>
          </View>
        )}

        {!!companySettings?.instagram && (
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => Linking.openURL(`https://instagram.com/${companySettings.instagram}`)}
          >
            <Text style={styles.menuItemIcon}>📸</Text>
            <Text style={styles.menuItemLabel}>Instagram (@{companySettings.instagram})</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        )}

        {!!companySettings?.facebook && (
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => Linking.openURL(`https://facebook.com/${companySettings.facebook}`)}
          >
            <Text style={styles.menuItemIcon}>👤</Text>
            <Text style={styles.menuItemLabel}>Facebook ({companySettings.facebook})</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cerrar Sesión */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
        <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
      </TouchableOpacity>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Química General Deheza · Cliente Final</Text>
      </View>

      {/* Footer Legal & Ayuda */}
      <AppFooter />

      <OrderDetailModal
        order={selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
        onRepeat={handleRepeatOrder}
      />
    </ScrollView>
  );



}const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.huge,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: FontWeight.extrabold,
    color: Colors.white,
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  customerName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  razonSocial: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  zonaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
  },
  zonaBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    padding: Spacing.xl,
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  cardDesc: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 22,
  },
  addressBox: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  addressTitle: {
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  addressText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  addressSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  menuItemIcon: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  menuItemLabel: {
    flex: 1,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  menuItemArrow: {
    fontSize: FontSize.xxl,
    color: Colors.textDisabled,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'flex-start',
  },
  paymentIcon: {
    fontSize: 28,
  },
  paymentTextCol: {
    flex: 1,
  },
  paymentMethodTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  paymentMethodDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  orderSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  orderSummaryTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  orderSummaryDate: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  orderSummaryPrice: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  repeatBtn: {
    height: 56,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  repeatBtnText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  frequentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  frequentItemBullet: {
    fontSize: 14,
  },
  frequentItemText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  section: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xxl,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  filterSectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  noResultsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  noResultsTitle: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  noResultsSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  resetFiltersBtn: {
    backgroundColor: Colors.primary + '18',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  resetFiltersBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  orderItemCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  orderNumberText: {
    fontWeight: 'bold',
    fontSize: FontSize.lg,
  },
  orderStatusText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  orderDateText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    marginBottom: Spacing.xs,
  },
  orderTotalText: {
    fontWeight: 'bold',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  smallRepeatButton: {
    height: 48,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallRepeatButtonText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  logoutButton: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xxl,
    height: 60,
    backgroundColor: '#fee2e2',
    borderWidth: 2,
    borderColor: '#fca5a5',
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#dc2626',
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  versionText: {
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
  },
})