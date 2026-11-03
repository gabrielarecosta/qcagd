import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView, 
  Linking,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '../components/icons/MaterialCommunityIcons';
import { Colors } from '../constants/Colors';
import { FontSize, FontWeight } from '../constants/Typography';
import { Radius, Spacing } from '../constants/Spacing';
import { Button } from '../components/ui/Button';
import { companySettingsService } from '@shared/services/companySettingsService';
import { orderService } from '@shared/services/orderService';
import { formatPrice } from '../utils/formatters';
import { buildWhatsAppOrderMessage, WhatsAppOrderItem } from '@shared/utils/whatsappOrderMessage';
import { useAuthStore } from '../store/authStore';

const DELIVERY_OPTIONS: Record<string, { icon: string; label: string }> = {
  reparto: {
    icon: '🚚',
    label: 'Envío por reparto',
  },
  retiro: {
    icon: '🏪',
    label: 'Retiro en local',
  },
  whatsapp: {
    icon: '💬',
    label: 'Coordinar por WhatsApp',
  },
};

export default function PedidoConfirmadoScreen() {
  const router = useRouter();
  const clientData = useAuthStore((state) => state.clientData);
  const params = useLocalSearchParams<{
    orderId?: string;
    orderNum?: string;
    orderTotal?: string;
    deliveryMethod?: string;
    paymentMethod?: string;
    deliveryDate?: string;
    slotNombre?: string;
    slotHoraInicio?: string;
    slotHoraFin?: string;
    outOfStockPreference?: string;
    observaciones?: string;
    itemsJson?: string;
  }>();

  const [companySettings, setCompanySettings] = useState<any>(null);

  const orderNum = params.orderNum || '—';
  const orderTotal = params.orderTotal ? Number(params.orderTotal) : 0;
  const deliveryMethod = params.deliveryMethod || 'reparto';
  const paymentMethod = params.paymentMethod || 'efectivo';
  const deliveryDate = params.deliveryDate || '';
  const slotNombre = params.slotNombre || '';
  const slotHoraInicio = params.slotHoraInicio || '';
  const slotHoraFin = params.slotHoraFin || '';
  const outOfStockPreference = params.outOfStockPreference || 'llamar';
  const observaciones = params.observaciones || '';

  const parsedItems: any[] = React.useMemo(() => {
    if (!params.itemsJson) return [];
    try {
      return JSON.parse(params.itemsJson);
    } catch {
      return [];
    }
  }, [params.itemsJson]);

  const [dbItems, setDbItems] = useState<any[]>([]);
  const [isLoadingDbItems, setIsLoadingDbItems] = useState(false);

  useEffect(() => {
    if (parsedItems.length === 0 && params.orderId) {
      setIsLoadingDbItems(true);
      orderService.getOrderItems(params.orderId)
        .then(items => {
          setDbItems(items.map(it => ({
            name: it.producto?.nombre || 'Producto',
            presentation: it.producto?.presentacion,
            imagen: it.producto?.imagen,
            qty: it.cantidad,
            unitPrice: it.precioUnitario,
            subtotal: it.subtotal,
          })));
        })
        .catch(err => console.warn('No se pudieron cargar artículos de la BD:', err))
        .finally(() => setIsLoadingDbItems(false));
    }
  }, [params.orderId, parsedItems.length]);

  const itemsList = parsedItems.length > 0 ? parsedItems : dbItems;
  const totalArticulos = itemsList.reduce((acc, it) => acc + (Number(it.qty) || 1), 0);

  const selectedOption = DELIVERY_OPTIONS[deliveryMethod] || DELIVERY_OPTIONS['reparto'];
  const paymentLabel =
    paymentMethod === 'efectivo'
      ? 'Efectivo / Contra entrega'
      : paymentMethod === 'mercadopago'
      ? 'Mercado Pago'
      : paymentMethod === 'cuenta_corriente'
      ? 'Cuenta Corriente'
      : paymentMethod === 'pago_a_acordar'
      ? 'Pago a acordar'
      : 'Transferencia Bancaria';

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await companySettingsService.get();
        setCompanySettings(settings);
      } catch (err) {
        console.warn('Error cargando configuración de la empresa:', err);
      }
    };
    loadSettings();
  }, []);

  const handleSendReceipt = () => {
    const waMessage = buildWhatsAppOrderMessage({
      orderNum: orderNum,
      customerName: clientData?.nombre || 'Cliente',
      customerPhone: clientData?.telefono || '',
      items: itemsList.map(it => ({
        name: it.name,
        presentation: it.presentation,
        qty: it.qty,
        unitPrice: it.unitPrice,
        subtotal: it.subtotal,
      })),
      total: orderTotal,
      deliveryMethod: deliveryMethod,
      deliveryDate: deliveryDate || undefined,
      deliveryTimeSlot: slotHoraInicio && slotHoraFin ? `${slotHoraInicio} a ${slotHoraFin} hs` : undefined,
      address: clientData?.direccion,
      outOfStockPreference: outOfStockPreference,
      observaciones: observaciones,
      paymentMethod: paymentMethod,
      isTransferReceipt: true,
    });

    const targetNumber = companySettings?.whatsapp_transferencias || companySettings?.whatsapp || '5493511234567';
    const cleanPhone = targetNumber.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={[
          { flex: 1 },
          Platform.OS === 'web' && ({ overflowY: 'scroll' } as any),
        ]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        persistentScrollbar={true}
        // @ts-ignore
        dataSet={{ mainScroll: 'true' }}
      >
        <View style={styles.confirmedContainer}>
          <Text style={styles.confirmedIcon}>🎉</Text>

          <Text style={styles.confirmedTitle}>¡Pedido confirmado!</Text>
          <Text style={styles.confirmedOrderNum}>{orderNum}</Text>

          <View style={styles.confirmedInfoCard}>
            <View style={styles.confirmedInfoRow}>
              <Text style={styles.confirmedInfoIcon}>{selectedOption.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.confirmedInfoLabel}>Forma de entrega</Text>
                <Text style={styles.confirmedInfoValue}>{selectedOption.label}</Text>
              </View>
            </View>

            <View style={[styles.confirmedInfoRow, styles.rowBorder]}>
              <Text style={styles.confirmedInfoIcon}>💳</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.confirmedInfoLabel}>Método de Pago</Text>
                <Text style={styles.confirmedInfoValue}>{paymentLabel}</Text>
              </View>
            </View>

            <View style={[styles.confirmedInfoRow, styles.rowBorder]}>
              <Text style={styles.confirmedInfoIcon}>✅</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.confirmedInfoLabel}>Estado</Text>
                <Text style={styles.confirmedInfoValue}>
                  {deliveryMethod === 'whatsapp'
                    ? 'En consulta con el local'
                    : 'Recibido — Lo preparamos ya'}
                </Text>
              </View>
            </View>

            {deliveryMethod !== 'retiro' && !!slotNombre && (
              <View style={[styles.confirmedInfoRow, styles.rowBorder]}>
                <Text style={styles.confirmedInfoIcon}>📅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.confirmedInfoLabel}>Entrega Programada</Text>
                  <Text style={styles.confirmedInfoValue}>
                    {deliveryDate} ({slotNombre})
                  </Text>
                  {!!slotHoraInicio && !!slotHoraFin && (
                    <Text style={styles.slotTimeText}>
                      De {slotHoraInicio} a {slotHoraFin} hs
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* ======================================================== */}
          {/* ARTÍCULOS PEDIDOS EN EL PEDIDO CONFIRMADO                */}
          {/* ======================================================== */}
          <View style={styles.confirmedItemsCard}>
            <View style={styles.confirmedItemsHeader}>
              <View style={styles.confirmedItemsHeaderLeft}>
                <MaterialCommunityIcons name="package-variant-closed" size={22} color={Colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.confirmedItemsTitle}>Artículos pedidos</Text>
              </View>
              {totalArticulos > 0 && (
                <View style={styles.itemsCountBadge}>
                  <Text style={styles.itemsCountBadgeText}>
                    {totalArticulos} {totalArticulos === 1 ? 'artículo' : 'artículos'}
                  </Text>
                </View>
              )}
            </View>

            {isLoadingDbItems ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={{ marginTop: 8, fontSize: FontSize.sm, color: Colors.textSecondary }}>Cargando artículos...</Text>
              </View>
            ) : itemsList.length > 0 ? (
              <View style={styles.itemsListWrapper}>
                {itemsList.map((item, idx) => (
                  <View key={idx} style={[styles.confirmedItemRow, idx > 0 && styles.itemRowBorder]}>
                    <View style={styles.itemQtyBadge}>
                      <Text style={styles.itemQtyBadgeText}>{item.qty}x</Text>
                    </View>
                    <View style={styles.itemInfoCol}>
                      <Text
                        style={styles.confirmedItemName}
                        numberOfLines={2}
                        {...(Platform.OS === 'web' ? ({ translate: 'no', className: 'notranslate' } as any) : {})}
                      >
                        {Platform.OS === 'web' ? (
                          <span className="notranslate" translate="no">
                            {item.name}
                          </span>
                        ) : (
                          item.name
                        )}
                      </Text>
                      {!!item.presentation && item.presentation !== 'Presentación Importada' && (
                        <Text style={styles.confirmedItemPresentation}>{item.presentation}</Text>
                      )}
                      <Text style={styles.confirmedItemUnitPrice}>
                        {formatPrice(item.unitPrice)} c/u
                      </Text>
                    </View>
                    <Text style={styles.confirmedItemSubtotal}>{formatPrice(item.subtotal)}</Text>
                  </View>
                ))}

                <View style={styles.confirmedItemsTotalRow}>
                  <Text style={styles.confirmedTotalLabel}>Total del Pedido:</Text>
                  <Text style={styles.confirmedTotalValue}>{formatPrice(orderTotal)}</Text>
                </View>
              </View>
            ) : (
              <View style={{ paddingVertical: 8 }}>
                <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' }}>
                  Pedido registrado con éxito por un total de {formatPrice(orderTotal)}.
                </Text>
              </View>
            )}
          </View>

          {/* Cuadro especial si eligió transferencia */}
          {paymentMethod === 'transferencia' && (
            <View style={styles.confirmedBankCard}>
              <Text style={styles.bankCardTitle}>🏦 Completar Transferencia</Text>
              <Text style={styles.bankCardSubtitle}>
                Transferí el total de {formatPrice(orderTotal)} a la cuenta de la química:
              </Text>

              <View style={styles.bankCardDetails}>
                <View style={styles.bankCardRow}>
                  <Text style={styles.bankCardLabel}>Banco:</Text>
                  <Text style={styles.bankCardVal}>{companySettings?.banco || '—'}</Text>
                </View>
                <View style={styles.bankCardRow}>
                  <Text style={styles.bankCardLabel}>Titular:</Text>
                  <Text style={styles.bankCardVal}>{companySettings?.titular || '—'}</Text>
                </View>
                <View style={styles.bankCardRow}>
                  <Text style={styles.bankCardLabel}>Alias:</Text>
                  <Text style={[styles.bankCardVal, { fontWeight: FontWeight.bold, color: Colors.primary }]}>
                    {companySettings?.alias_cbu || '—'}
                  </Text>
                </View>
                <View style={styles.bankCardRow}>
                  <Text style={styles.bankCardLabel}>CBU:</Text>
                  <Text style={styles.bankCardVal}>{companySettings?.cbu || '—'}</Text>
                </View>
                <View style={styles.bankCardRow}>
                  <Text style={styles.bankCardLabel}>CUIT:</Text>
                  <Text style={styles.bankCardVal}>{companySettings?.cuit || '—'}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.sendReceiptBtn}
                onPress={handleSendReceipt}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="whatsapp" size={20} color={Colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.sendReceiptBtnText}>Ya pagué, enviar comprobante</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.confirmedSubtitle}>
            {deliveryMethod === 'reparto'
              ? 'Te avisamos cuando tu pedido salga para reparto'
              : deliveryMethod === 'retiro'
              ? 'Te avisamos cuando esté listo para retirar'
              : 'Te contactamos por WhatsApp para coordinar'}
          </Text>

          <View style={styles.confirmedActions}>
            <Button
              title="Ver mis pedidos"
              variant="primary"
              size="lg"
              onPress={() => {
                router.replace('/(tabs)/cuenta');
              }}
            />
            <Button
              title="Hacer otro pedido"
              variant="outline"
              size="md"
              onPress={() => {
                router.replace('/(tabs)/catalogo');
              }}
            />
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
  scrollContent: {
    flexGrow: 1,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmedContainer: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  confirmedIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  confirmedTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  confirmedOrderNum: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
    marginBottom: Spacing.xl,
  },
  confirmedInfoCard: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  confirmedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  confirmedInfoIcon: {
    fontSize: 24,
  },
  confirmedInfoLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  confirmedInfoValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  slotTimeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  confirmedBankCard: {
    width: '100%',
    backgroundColor: '#F0FDF4',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: Spacing.xl,
  },
  bankCardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#166534',
    marginBottom: 4,
  },
  bankCardSubtitle: {
    fontSize: FontSize.xs,
    color: '#15803D',
    marginBottom: Spacing.md,
  },
  bankCardDetails: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  bankCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankCardLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  bankCardVal: {
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
    fontSize: FontSize.sm,
  },
  confirmedSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  confirmedActions: {
    width: '100%',
    gap: Spacing.md,
  },
  confirmedItemsCard: {
    width: '100%',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  confirmedItemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: Spacing.sm,
  },
  confirmedItemsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confirmedItemsTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  itemsCountBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  itemsCountBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: '#1E40AF',
  },
  itemsListWrapper: {
    width: '100%',
  },
  confirmedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  itemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  itemQtyBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    marginRight: Spacing.md,
  },
  itemQtyBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  itemInfoCol: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  confirmedItemName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  confirmedItemPresentation: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  confirmedItemUnitPrice: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  confirmedItemSubtotal: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  confirmedItemsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  confirmedTotalLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  confirmedTotalValue: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
});
