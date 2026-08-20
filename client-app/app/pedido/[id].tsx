import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '../../components/icons/MaterialCommunityIcons';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../types';
import { formatPrice, formatDate } from '../../utils/formatters';
import { useOrderStore } from '../../store/orderStore';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { companySettingsService } from '@shared/services/companySettingsService';
import { orderService } from '@shared/services/orderService';
import { buildWhatsAppOrderMessage } from '@shared/utils/whatsappOrderMessage';
import { customAlert } from '../../utils/alert';

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { orders, fetchOrders } = useOrderStore();
  const { clientData, isLoggedIn } = useAuthStore();
  const repeatOrder = useCartStore((state) => state.repeatOrder);

  const [companySettings, setCompanySettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isGeneratingMpLink, setIsGeneratingMpLink] = useState(false);

  const isMpLinkExpired = (ord: Order) => {
    if (!ord.mpPreferenceExpiresAt) return true;
    return new Date(ord.mpPreferenceExpiresAt).getTime() <= Date.now();
  };

  const handlePayMercadoPago = async (ord: Order) => {
    setIsGeneratingMpLink(true);
    try {
      const expired = isMpLinkExpired(ord);
      if (!expired && ord.mpInitPoint) {
        if (Platform.OS === 'web') {
          window.location.href = ord.mpInitPoint;
        } else {
          Linking.openURL(ord.mpInitPoint);
        }
        return;
      }

      // Enlace expirado o no generado aún: crear nueva preferencia de 24 hs
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
      const mpRes = await fetch(`${backendUrl}/api/mercadopago/create-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: ord.id,
          items: ord.items.map((i) => ({
            title: i.producto.nombre,
            unit_price: i.precioUnitario,
            quantity: i.cantidad,
          })),
          payer: {
            name: clientData?.nombre || ord.customerName || 'Cliente',
            email: clientData?.email || '',
          },
        }),
      });

      if (!mpRes.ok) {
        throw new Error('No se pudo conectar con Mercado Pago.');
      }

      const mpData = await mpRes.json();
      const link = mpData.init_point || mpData.sandbox_init_point;
      if (!link) {
        throw new Error('Mercado Pago no retornó un enlace válido.');
      }

      if (mpData.preferenceId && mpData.expiresAt) {
        await orderService.updateMercadoPagoPreference(ord.id, mpData.preferenceId, link, mpData.expiresAt);
      }

      if (Platform.OS === 'web') {
        window.location.href = link;
      } else {
        Linking.openURL(link);
      }
    } catch (err: any) {
      customAlert('Error', err.message || 'No se pudo procesar el pago con Mercado Pago.');
    } finally {
      setIsGeneratingMpLink(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [settings] = await Promise.all([
          companySettingsService.get(),
          fetchOrders(clientData?.id),
        ]);
        setCompanySettings(settings);
      } catch (err) {
        console.warn('Error cargando pedido:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, clientData?.id]);

  const targetOrder = orders.find(
    (o) => o.id === id || o.numero === id || o.numero === `#${id}`
  );

  const handleRepeatOrder = (ord: Order) => {
    repeatOrder(ord);
    customAlert('Pedido cargado', 'Los artículos se agregaron a tu Carrito.');
    router.push('/(tabs)/carrito');
  };

  const handleSendReceipt = (ord: Order) => {
    const waMessage = buildWhatsAppOrderMessage({
      orderNum: ord.numero,
      customerName: ord.customerName,
      customerPhone: ord.customerPhone,
      items: (ord.items || []).map((it) => ({
        name: it.producto?.nombre || 'Producto',
        presentation: it.producto?.presentacion,
        qty: it.cantidad,
        unitPrice: it.precioUnitario,
        subtotal: it.subtotal,
      })),
      total: ord.total,
      deliveryMethod: ord.deliveryMethod,
      deliveryDate: ord.deliveryDate,
      deliveryTimeSlot: ord.deliveryStartTime && ord.deliveryEndTime ? `${ord.deliveryStartTime} a ${ord.deliveryEndTime} hs` : undefined,
      address: ord.formattedAddress || ord.originalAddress,
      outOfStockPreference: ord.outOfStockPreference,
      observaciones: ord.observaciones,
      paymentMethod: ord.paymentMethod,
      isTransferReceipt: true,
    });

    const targetNumber = companySettings?.whatsapp_transferencias || companySettings?.whatsapp || '5493511234567';
    const cleanPhone = targetNumber.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando detalle del pedido...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!targetOrder) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pedido no encontrado</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No encontramos la información de este pedido</Text>
          <Text style={styles.emptySub}>Es posible que el pedido ya no esté disponible o hayas ingresado un enlace incorrecto.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/cuenta')}>
            <Text style={styles.primaryBtnText}>Volver a Mi Cuenta</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = ORDER_STATUS_COLORS[targetOrder.estado] || Colors.primary;
  const statusLabel = ORDER_STATUS_LABELS[targetOrder.estado] || targetOrder.estado;

  const paymentMethodLabel =
    targetOrder.paymentMethod === 'efectivo'
      ? '💵 Efectivo contra entrega'
      : targetOrder.paymentMethod === 'mercadopago'
      ? '💳 Mercado Pago'
      : targetOrder.paymentMethod === 'transferencia'
      ? '🏦 Transferencia Bancaria'
      : targetOrder.paymentMethod || 'Efectivo';

  const paymentStatus = targetOrder.paymentStatus || (targetOrder.paymentMethod === 'mercadopago' ? 'pendiente' : 'pendiente');
  const isPaid = paymentStatus === 'pagado' || paymentStatus === 'approved';
  const isRejected = paymentStatus === 'rechazado' || paymentStatus === 'rejected';

  const deliveryMethodLabel =
    targetOrder.deliveryMethod === 'retiro'
      ? '🏪 Retiro en local'
      : targetOrder.deliveryMethod === 'whatsapp'
      ? '💬 Coordinar por WhatsApp'
      : '🚚 Envío por reparto';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>Pedido {targetOrder.numero}</Text>
          <Text style={styles.headerSubTitle}>{formatDate(targetOrder.fecha)}</Text>
        </View>
        <View style={[styles.statusBadgeTop, { backgroundColor: `${statusColor}18` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusTextTop, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.contentCard}>
          {/* Badges de estado principales */}
          <View style={styles.badgesRow}>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isPaid ? '#DCFCE7' : isRejected ? '#FEE2E2' : '#FEF3C7',
                  borderColor: isPaid ? '#86EFAC' : isRejected ? '#FCA5A5' : '#FDE68A',
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: isPaid ? '#15803D' : isRejected ? '#B91C1C' : '#B45309' },
                ]}
              >
                {isPaid ? '✅ PAGO APROBADO' : isRejected ? '❌ PAGO RECHAZADO' : '⏳ PAGO PENDIENTE'}
              </Text>
            </View>

            <View style={[styles.badge, styles.deliveryBadge]}>
              <Text style={styles.deliveryBadgeText}>{deliveryMethodLabel}</Text>
            </View>
          </View>

          {/* Cuadro de aviso si el pago está pendiente por Mercado Pago */}
          {targetOrder.paymentMethod === 'mercadopago' && !isPaid && targetOrder.estado !== 'cancelado' && (
            <View style={[styles.pendingBankCard, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
              <View style={styles.pendingBankHeader}>
                <Text style={[styles.pendingBankTitle, { color: '#0369A1' }]}>💳 Pago con Mercado Pago pendiente</Text>
                <Text style={[styles.pendingBankSub, { color: '#0284C7' }]}>
                  {isMpLinkExpired(targetOrder)
                    ? 'Tu enlace de pago anterior ha expirado (vigencia de 24 hs). Podés generar un nuevo enlace con un solo clic.'
                    : 'Podés abonar este pedido ahora a través de Mercado Pago. El enlace de pago se mantiene activo por 24 hs.'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.sendReceiptBtn, { backgroundColor: '#009EE3' }]}
                onPress={() => handlePayMercadoPago(targetOrder)}
                disabled={isGeneratingMpLink}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="credit-card-outline" size={20} color={Colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.sendReceiptBtnText}>
                  {isGeneratingMpLink
                    ? '⌛ Conectando con Mercado Pago...'
                    : isMpLinkExpired(targetOrder)
                    ? '🔄 Generar Nuevo Enlace de Pago (Mercado Pago)'
                    : '💳 Pagar con Mercado Pago'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cuadro de aviso si el pago está pendiente por Transferencia */}
          {targetOrder.paymentMethod === 'transferencia' && !isPaid && (
            <View style={styles.pendingBankCard}>
              <View style={styles.pendingBankHeader}>
                <Text style={styles.pendingBankTitle}>🏦 Transferencia bancaria pendiente</Text>
                <Text style={styles.pendingBankSub}>
                  Para procesar tu pedido, transferí {formatPrice(targetOrder.total)} a la cuenta de la química:
                </Text>
              </View>

              <View style={styles.bankDetailsBox}>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Banco:</Text>
                  <Text style={styles.bankVal}>{companySettings?.banco || '—'}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Titular:</Text>
                  <Text style={styles.bankVal}>{companySettings?.titular || '—'}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Alias:</Text>
                  <Text style={[styles.bankVal, { color: Colors.primary, fontWeight: FontWeight.bold }]}>
                    {companySettings?.alias_cbu || '—'}
                  </Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>CBU:</Text>
                  <Text style={styles.bankVal}>{companySettings?.cbu || '—'}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>CUIT:</Text>
                  <Text style={styles.bankVal}>{companySettings?.cuit || '—'}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.sendReceiptBtn}
                onPress={() => handleSendReceipt(targetOrder)}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="whatsapp" size={20} color={Colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.sendReceiptBtnText}>Enviar comprobante por WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Información de entrega y pago */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionHeaderTitle}>Información del Pedido</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Método de entrega:</Text>
              <Text style={styles.infoValue}>{deliveryMethodLabel}</Text>
            </View>

            {targetOrder.deliveryMethod === 'reparto' && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Dirección de entrega:</Text>
                <Text style={styles.infoValue}>{targetOrder.formattedAddress || 'Dirección registrada'}</Text>
              </View>
            )}

            {targetOrder.deliveryDate && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Entrega programada:</Text>
                <Text style={[styles.infoValue, { color: Colors.primary, fontWeight: FontWeight.bold }]}>
                  {targetOrder.deliveryDate} ({targetOrder.deliveryStartTime || '14:00'} a {targetOrder.deliveryEndTime || '18:00'} hs)
                </Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Forma de Pago:</Text>
              <Text style={styles.infoValue}>{paymentMethodLabel}</Text>
            </View>

            {targetOrder.paymentMethod === 'efectivo' && !!targetOrder.abonaCon && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Abona con:</Text>
                <Text style={styles.infoValue}>
                  {formatPrice(targetOrder.abonaCon)} {targetOrder.cambioEstimado ? `(Vuelto: ${formatPrice(targetOrder.cambioEstimado)})` : ''}
                </Text>
              </View>
            )}

            {targetOrder.observaciones ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Observaciones:</Text>
                <Text style={[styles.infoValue, { fontStyle: 'italic' }]}>{targetOrder.observaciones}</Text>
              </View>
            ) : null}
          </View>

          {/* Listado de Productos */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionHeaderTitle}>Productos ({targetOrder.items.length})</Text>

            {targetOrder.items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <View style={styles.itemMain}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.producto.nombre}
                  </Text>
                  <Text style={styles.itemSub}>
                    {item.cantidad} x {formatPrice(item.precioUnitario)}
                  </Text>
                </View>
                <Text style={styles.itemSubtotal}>{formatPrice(item.subtotal)}</Text>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total del Pedido:</Text>
              <Text style={styles.totalVal}>{formatPrice(targetOrder.total)}</Text>
            </View>
          </View>

          {/* Acciones Rápidas */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => handleRepeatOrder(targetOrder)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="cart-arrow-down" size={20} color={Colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Repetir esta compra</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.back()}
              activeOpacity={0.85}
            >
              <Text style={styles.secondaryBtnText}>Volver a mis pedidos</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerSubTitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  statusBadgeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusTextTop: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  scrollContent: {
    padding: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentCard: {
    width: '100%',
    maxWidth: 600,
    gap: Spacing.lg,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  deliveryBadge: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  deliveryBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  pendingBankCard: {
    backgroundColor: '#FEFCE8',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FEF08A',
  },
  pendingBankHeader: {
    marginBottom: Spacing.md,
  },
  pendingBankTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#854D0E',
    marginBottom: 2,
  },
  pendingBankSub: {
    fontSize: FontSize.xs,
    color: '#A16207',
  },
  bankDetailsBox: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 6,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bankLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  bankVal: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  sendReceiptBtn: {
    backgroundColor: '#25D366',
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm + 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendReceiptBtnText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.xs,
  },
  infoSection: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  sectionHeaderTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  infoLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flex: 1.5,
    textAlign: 'right',
  },
  itemsSection: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemMain: {
    flex: 1,
    marginRight: Spacing.md,
  },
  itemName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  itemSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.md,
    marginTop: Spacing.xs,
  },
  totalLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  totalVal: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  actionsContainer: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  primaryBtn: {
    height: 50,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  secondaryBtn: {
    height: 46,
    backgroundColor: '#E2E8F0',
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  emptySub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
});
