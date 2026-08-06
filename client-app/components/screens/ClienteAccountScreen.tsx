import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  TextInput,
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
  const { clientData, logout } = useAuthStore();
  const { orders } = useOrderStore();
  const { repeatOrder } = useCartStore();

  const [companySettings, setCompanySettings] = useState<any>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDireccion, setNewDireccion] = useState('');
  const [newZona, setNewZona] = useState('Centro');
  const [newIndicaciones, setNewIndicaciones] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

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

  const handleSaveAddress = async () => {
    if (!clientData || !newDireccion.trim()) return;
    setSavingAddress(true);
    try {
      let lat = -32.7566;
      let lon = -63.7861;
      let verified = false;

      try {
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.quimicagd.com.ar';
        const response = await fetch(`${backendUrl}/api/geocoding/autocomplete?text=${encodeURIComponent(newDireccion + ', General Deheza, Córdoba')}`);
        if (response.ok) {
          const result = await response.json();
          if (result.features && result.features.length > 0) {
            const first = result.features[0];
            lon = first.geometry.coordinates[0];
            lat = first.geometry.coordinates[1];
            verified = true;
          }
        }
      } catch (e) {
        console.warn('Geocoding fallback:', e);
      }

      await clientService.addAddress({
        customerId: clientData.id,
        direccion: newDireccion,
        zona: newZona,
        indicaciones: newIndicaciones || undefined,
        latitude: lat,
        longitude: lon,
        locationVerified: verified,
        defaultAddress: addresses.length === 0,
      });

      await loadAddresses();
      setNewDireccion('');
      setNewIndicaciones('');
      setShowAddForm(false);
      customAlert('Éxito', 'Dirección agregada correctamente.');
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
  }, [clientData]);

  const clientOrders = useMemo(() => {
    if (!clientData) return [];
    return orders.filter(o => o.clienteId === clientData.id);
  }, [orders, clientData]);

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
          {clientData.razonSocial && (
            <Text style={styles.razonSocial}>{clientData.razonSocial}</Text>
          )}
          <View style={styles.zonaBadge}>
            <Text style={styles.zonaBadgeText}>Zona {clientData.zona || 'Centro'}</Text>
          </View>
        </View>
      </View>

      {/* Mis Datos */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mis datos</Text>
        <InfoRow label="Razón Social" value={clientData.razonSocial || clientData.nombre} />
        <InfoRow label="CUIT / DNI" value={clientData.cuit || '-'} />
        <InfoRow label="Teléfono" value={clientData.telefono} />
        <InfoRow label="Email" value={clientData.email || '-'} />
        <InfoRow label="Tipo de Cliente" value={clientData.tipoCliente === 'mayorista' ? 'Mayorista' : 'Minorista'} />
      </View>

      {/* Direcciones de Entrega */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Direcciones de entrega</Text>
        
        {addresses.map((addr) => (
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
                <TouchableOpacity
                  onPress={async () => {
                    await clientService.deleteAddress(addr.id!);
                    await loadAddresses();
                    customAlert('Eliminada', 'Dirección eliminada correctamente.');
                  }}
                >
                  <Text style={{ fontSize: 13, color: Colors.danger, fontWeight: 'bold' }}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.addressText}>{addr.direccion}</Text>
            <Text style={styles.addressSub}>Zona {addr.zona}</Text>
            {addr.indicaciones ? (
              <Text style={{ fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 2 }}>
                ℹ️ {addr.indicaciones}
              </Text>
            ) : null}
          </View>
        ))}

        {addresses.length === 0 && (
          <View style={styles.addressBox}>
            <Text style={styles.addressTitle}>🏠 Dirección Principal</Text>
            <Text style={styles.addressText}>{clientData.direccion}</Text>
            <Text style={styles.addressSub}>Zona {clientData.zona || 'Centro'}</Text>
          </View>
        )}

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
            <View style={{ backgroundColor: 'white', borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 8, marginBottom: Spacing.md }}>
              <TextInput
                placeholder="Ej: Bv. San Martín 456, General Deheza"
                value={newDireccion}
                onChangeText={setNewDireccion}
                style={{ fontSize: 14, color: Colors.textPrimary, padding: 0 }}
              />
            </View>

            <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 4 }}>Zona de Entrega</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.md }}>
              {['Centro', 'Norte', 'Sur'].map((z) => (
                <TouchableOpacity
                  key={z}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: Radius.sm,
                    borderWidth: 1,
                    borderColor: newZona === z ? Colors.primary : Colors.border,
                    backgroundColor: newZona === z ? Colors.primary + '15' : 'white',
                    alignItems: 'center',
                  }}
                  onPress={() => setNewZona(z)}
                >
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: newZona === z ? Colors.primary : Colors.textSecondary }}>
                    {z}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
            <Text style={styles.orderSummaryDate}>Fecha: {new Date(lastOrder.fecha).toLocaleDateString()}</Text>
            {lastOrder.deliveryDate && (
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
        {clientOrders.length === 0 ? (
          <Text style={styles.emptyText}>No tenés pedidos registrados todavía.</Text>
        ) : (
          clientOrders.map((o) => (
            <View key={o.id} style={styles.orderItemCard}>
              <View style={styles.orderItemHeader}>
                <Text style={styles.orderNumberText}>Pedido #{o.numero}</Text>
                <Text style={[styles.orderStatusText, { color: Colors.primary }]}>{o.estado.toUpperCase()}</Text>
              </View>
              <Text style={styles.orderDateText}>
                Fecha: {new Date(o.fecha).toLocaleDateString()}
              </Text>
              <Text style={styles.orderTotalText}>
                Monto: {formatPrice(o.total)}
              </Text>
              <TouchableOpacity style={styles.smallRepeatButton} onPress={() => handleRepeatOrder(o)} activeOpacity={0.8}>
                <Text style={styles.smallRepeatButtonText}>🛒 Repetir pedido</Text>
              </TouchableOpacity>
            </View>
          ))
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

        {companySettings?.direccion && (
          <View style={[styles.menuItem, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <Text style={styles.menuItemIcon}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.md, color: Colors.textSecondary }}>Nuestra Dirección</Text>
              <Text style={{ fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textPrimary, marginTop: 2 }}>{companySettings.direccion}</Text>
            </View>
          </View>
        )}

        {companySettings?.instagram && (
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => Linking.openURL(`https://instagram.com/${companySettings.instagram}`)}
          >
            <Text style={styles.menuItemIcon}>📸</Text>
            <Text style={styles.menuItemLabel}>Instagram (@{companySettings.instagram})</Text>
            <Text style={styles.menuItemArrow}>›</Text>
          </TouchableOpacity>
        )}

        {companySettings?.facebook && (
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
        <Text style={styles.versionText}>Química Deheza · Cliente Final</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: Spacing.lg,
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
});
