import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Linking,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from './icons/MaterialCommunityIcons';
import { Colors } from '../constants/Colors';
import { FontSize, FontWeight } from '../constants/Typography';
import { Radius, Spacing } from '../constants/Spacing';
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../types';
import { formatPrice, formatDate, formatTime } from '../utils/formatters';
import { companySettingsService } from '@shared/services/companySettingsService';
import { buildWhatsAppOrderMessage } from '@shared/utils/whatsappOrderMessage';
import { useRouter } from 'expo-router';

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onRepeat?: (order: Order) => void;
}

export function OrderDetailModal({ order, onClose, onRepeat }: OrderDetailModalProps) {
  const router = useRouter();
  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    const loadSettings = async () => {
      const settings = await companySettingsService.get();
      setCompanySettings(settings);
    };
    loadSettings();
  }, []);

  if (!order) return null;

  const statusColor = ORDER_STATUS_COLORS[order.estado] || Colors.primary;
  const statusLabel = ORDER_STATUS_LABELS[order.estado] || order.estado;

  const paymentMethodLabel =
    order.paymentMethod === 'efectivo'
      ? '💵 Efectivo contra entrega'
      : order.paymentMethod === 'mercadopago'
      ? '💳 Mercado Pago'
      : order.paymentMethod === 'transferencia'
      ? '🏦 Transferencia Bancaria'
      : order.paymentMethod === 'pago_a_acordar'
      ? '🤝 Pago a acordar'
      : order.paymentMethod === 'cuenta_corriente'
      ? '📋 Cuenta Corriente'
      : order.paymentMethod || 'Efectivo';

  const paymentStatus = order.paymentStatus || (order.paymentMethod === 'mercadopago' ? 'pendiente' : 'pendiente');
  const isPaid = paymentStatus === 'pagado' || paymentStatus === 'approved';
  const isRejected = paymentStatus === 'rechazado' || paymentStatus === 'rejected';

  const deliveryMethodLabel =
    order.deliveryMethod === 'retiro'
      ? '🏪 Retiro en local'
      : order.deliveryMethod === 'whatsapp'
      ? '💬 Coordinar por WhatsApp'
      : '🚚 Reparto a domicilio';

  const handleSendReceipt = () => {
    const waMessage = buildWhatsAppOrderMessage({
      orderNum: order.numero,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      items: (order.items || []).map((it) => ({
        name: it.producto?.nombre || 'Producto',
        presentation: it.producto?.presentacion,
        qty: it.cantidad,
        unitPrice: it.precioUnitario,
        subtotal: it.subtotal,
      })),
      total: order.total,
      deliveryMethod: order.deliveryMethod,
      deliveryDate: order.deliveryDate,
      deliveryTimeSlot: order.deliveryStartTime && order.deliveryEndTime ? `${order.deliveryStartTime} a ${order.deliveryEndTime} hs` : undefined,
      address: order.formattedAddress || order.originalAddress,
      outOfStockPreference: order.outOfStockPreference,
      observaciones: order.observaciones,
      paymentMethod: order.paymentMethod,
      isTransferReceipt: true,
    });

    const targetNumber = companySettings?.whatsapp_transferencias || companySettings?.whatsapp || '5493511234567';
    const cleanPhone = targetNumber.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`);
  };

  return (
    <Modal visible={!!order} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleCol}>
              <Text style={styles.orderTitle}>Pedido {order.numero}</Text>
              <Text style={styles.orderDate}>{formatDate(order.fecha)} a las {formatTime(order.fecha)} hs</Text>
            </View>
            <View style={styles.headerActions}>
              {/* Abrir en pantalla completa */}
              <TouchableOpacity
                style={styles.expandBtn}
                onPress={() => {
                  onClose();
                  router.push(`/pedido/${order.id}` as any);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="open-in-new" size={20} color={Colors.primary} />
              </TouchableOpacity>
              {/* Cerrar modal */}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Badges de Estado */}
            <View style={styles.badgesContainer}>
              {/* Estado del pedido */}
              <View style={[styles.badge, { backgroundColor: `${statusColor}15`, borderColor: `${statusColor}40` }]}>
                <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
              </View>

              {/* Estado del pago */}
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
            </View>

            {/* Cuadro de aviso si el pago está pendiente por Transferencia */}
            {order.paymentMethod === 'transferencia' && !isPaid && (
              <View style={styles.pendingBankCard}>
                <View style={styles.pendingBankHeader}>
                  <Text style={styles.pendingBankTitle}>🏦 Transferencia pendiente</Text>
                  <Text style={styles.pendingBankSub}>
                    Para procesar tu pedido, transferí {formatPrice(order.total)} a la cuenta:
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

                <TouchableOpacity style={styles.sendReceiptBtn} onPress={handleSendReceipt} activeOpacity={0.85}>
                  <MaterialCommunityIcons name="whatsapp" size={18} color={Colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.sendReceiptBtnText}>Enviar comprobante por WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Información General del Pedido */}
            <View style={styles.infoCard}>
              <Text style={styles.sectionHeaderTitle}>Detalles de Entrega y Pago</Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Método de entrega:</Text>
                <Text style={styles.infoValue}>{deliveryMethodLabel}</Text>
              </View>

              {order.deliveryMethod === 'reparto' && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Dirección de entrega:</Text>
                  <Text style={styles.infoValue}>{order.formattedAddress || 'Dirección de perfil'}</Text>
                </View>
              )}

              {order.deliveryZone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Zona:</Text>
                  <Text style={styles.infoValue}>Zona {order.deliveryZone}</Text>
                </View>
              )}

              {order.deliveryDate && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Entrega programada:</Text>
                  <Text style={[styles.infoValue, { color: Colors.primary, fontWeight: FontWeight.bold }]}>
                    {order.deliveryDate} ({order.deliveryStartTime || '14:00'} a {order.deliveryEndTime || '18:00'} hs)
                  </Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Forma de Pago:</Text>
                <Text style={styles.infoValue}>{paymentMethodLabel}</Text>
              </View>

              {order.paymentMethod === 'efectivo' && !!order.abonaCon && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Abona con:</Text>
                  <Text style={styles.infoValue}>
                    {formatPrice(order.abonaCon)} {order.cambioEstimado ? `(Vuelto: ${formatPrice(order.cambioEstimado)})` : ''}
                  </Text>
                </View>
              )}

              {order.outOfStockPreference && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Ante falta de stock:</Text>
                  <Text style={[styles.infoValue, { fontWeight: FontWeight.semibold, color: Colors.primary }]}>
                    {order.outOfStockPreference === 'reemplazar' ? '🔄 Elegir artículo similar' : '📞 Llamarme para consultar'}
                  </Text>
                </View>
              )}

              {order.observaciones ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Observaciones:</Text>
                  <Text style={[styles.infoValue, { fontStyle: 'italic' }]}>{order.observaciones}</Text>
                </View>
              ) : null}
            </View>

            {/* Listado de Productos */}
            <View style={styles.itemsCard}>
              <Text style={styles.sectionHeaderTitle}>Productos solicitados ({order.items.length})</Text>

              {order.items.map((item, idx) => (
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
                <Text style={styles.totalVal}>{formatPrice(order.total)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Acciones */}
          <View style={styles.footerActions}>
            {onRepeat && (
              <TouchableOpacity
                style={styles.repeatBtn}
                onPress={() => {
                  onClose();
                  onRepeat(order);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.repeatBtnText}>🛒 Repetir esta compra</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.closeModalBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeModalBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '90%',
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  headerTitleCol: {
    flex: 1,
  },
  orderTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  orderDate: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  expandBtn: {
    padding: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: `${Colors.primary}15`,
  },
  closeBtn: {
    padding: Spacing.xs,
    borderRadius: Radius.full,
    backgroundColor: '#E2E8F0',
  },
  scrollContent: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 6,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
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
    gap: 4,
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
  infoCard: {
    backgroundColor: Colors.background,
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
  itemsCard: {
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
  footerActions: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  repeatBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  closeModalBtn: {
    backgroundColor: '#E2E8F0',
    borderRadius: Radius.lg,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
