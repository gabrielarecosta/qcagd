import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { Spacing, Radius } from '../constants/Spacing';
import { FontSize } from '../constants/Typography';

interface OrderPaymentState {
  id: string;
  numero: string;
  total: number;
  paymentStatus: string; // 'pagado' | 'rechazado' | 'pendiente'
  estado: string;
  fecha: string;
  customerName?: string;
}

export default function ConfirmacionPagoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    order_id?: string;
    external_reference?: string;
    payment_id?: string;
    collection_id?: string;
    status?: string;
    collection_status?: string;
    merchant_order_id?: string;
  }>();

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderState, setOrderState] = useState<OrderPaymentState | null>(null);

  const orderId = params.order_id || params.external_reference;
  const paymentId = params.payment_id || params.collection_id;
  const urlStatus = params.status || params.collection_status;

  useEffect(() => {
    let isMounted = true;

    async function fetchPaymentStatus() {
      if (!orderId) {
        setIsLoading(false);
        setErrorMsg('No se proporcionó el número de pedido en el retorno de Mercado Pago.');
        return;
      }

      try {
        setIsLoading(true);
        const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
        const queryPaymentId = paymentId ? `?payment_id=${encodeURIComponent(paymentId)}` : '';
        
        const res = await fetch(`${backendUrl}/api/mercadopago/status/${encodeURIComponent(orderId)}${queryPaymentId}`);

        if (!res.ok) {
          throw new Error(`Error en el servidor (${res.status})`);
        }

        const data: OrderPaymentState = await res.json();
        if (isMounted) {
          setOrderState(data);
        }
      } catch (err: any) {
        console.error('Error al consultar estado de pago:', err);
        if (isMounted) {
          // Fallback construyendo estado visual a partir de los query params
          const mappedStatus = urlStatus === 'approved' ? 'pagado' : urlStatus === 'rejected' ? 'rechazado' : 'pendiente';
          setOrderState({
            id: orderId,
            numero: orderId,
            total: 0,
            paymentStatus: mappedStatus,
            estado: urlStatus === 'approved' ? 'en_preparacion' : 'pendiente',
            fecha: new Date().toISOString(),
          });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchPaymentStatus();

    return () => {
      isMounted = false;
    };
  }, [orderId, paymentId, urlStatus]);

  const fmtPrice = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = () => {
    const status = orderState?.paymentStatus || (urlStatus === 'approved' ? 'pagado' : urlStatus === 'rejected' ? 'rechazado' : 'pendiente');

    switch (status) {
      case 'pagado':
      case 'approved':
        return {
          icon: 'check-circle',
          iconColor: '#10B981',
          bg: '#ECFDF5',
          border: '#A7F3D0',
          title: '¡Pago Confirmado!',
          subtitle: 'Tu pago ha sido acreditado exitosamente. Ya estamos preparando tu pedido.',
          badgeLabel: 'PAGO APROBADO',
          badgeColor: '#059669',
        };
      case 'rechazado':
      case 'rejected':
      case 'cancelled':
        return {
          icon: 'close-circle',
          iconColor: '#EF4444',
          bg: '#FEF2F2',
          border: '#FECACA',
          title: 'Pago Rechazado',
          subtitle: 'El pago no pudo ser procesado por Mercado Pago. Podes intentar nuevamente.',
          badgeLabel: 'PAGO RECHAZADO',
          badgeColor: '#DC2626',
        };
      case 'pendiente':
      case 'pending':
      case 'in_process':
      default:
        return {
          icon: 'clock-outline',
          iconColor: '#F59E0B',
          bg: '#FFFBEB',
          border: '#FDE68A',
          title: 'Pago en Proceso',
          subtitle: 'Tu pago se encuentra pendiente de acreditación. Te informaremos en cuanto se confirme.',
          badgeLabel: 'PAGO PENDIENTE',
          badgeColor: '#D97706',
        };
    }
  };

  const statusInfo = getStatusBadge();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Consultando estado del pago en Mercado Pago...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#EF4444" />
              <Text style={styles.errorTitle}>Ocurrió un problema</Text>
              <Text style={styles.errorSubtitle}>{errorMsg}</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace('/(tabs)/catalogo' as any)}
              >
                <Text style={styles.primaryBtnText}>Volver al Catálogo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.statusContent}>
              {/* Header Icon */}
              <View style={[styles.iconContainer, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border }]}>
                <MaterialCommunityIcons name={statusInfo.icon as any} size={72} color={statusInfo.iconColor} />
              </View>

              <Text style={styles.title}>{statusInfo.title}</Text>
              <Text style={styles.subtitle}>{statusInfo.subtitle}</Text>

              {/* Status Badge */}
              <View style={[styles.badge, { backgroundColor: statusInfo.bg, borderColor: statusInfo.border }]}>
                <Text style={[styles.badgeText, { color: statusInfo.badgeColor }]}>{statusInfo.badgeLabel}</Text>
              </View>

              {/* Order Info Summary */}
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>N° de Pedido:</Text>
                  <Text style={styles.infoValue}>{orderState?.numero || orderId}</Text>
                </View>

                {orderState && orderState.total > 0 && (
                  <View style={[styles.infoRow, styles.infoRowBorder]}>
                    <Text style={styles.infoLabel}>Total del Pedido:</Text>
                    <Text style={styles.infoValueTotal}>{fmtPrice(orderState.total)}</Text>
                  </View>
                )}

                {paymentId && (
                  <View style={[styles.infoRow, styles.infoRowBorder]}>
                    <Text style={styles.infoLabel}>ID de Pago MP:</Text>
                    <Text style={styles.infoValueSub}>{paymentId}</Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => router.replace('/(tabs)/catalogo' as any)}
                >
                  <MaterialCommunityIcons name="store-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Volver al Catálogo</Text>
                </TouchableOpacity>

                {orderState?.paymentStatus === 'rechazado' && (
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => router.replace('/(tabs)/carrito' as any)}
                  >
                    <MaterialCommunityIcons name="refresh" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
                    <Text style={styles.secondaryBtnText}>Reintentar Pago</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.08)',
    elevation: 4,
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: FontSize.md,
    color: '#64748B',
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: FontSize.md,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  statusContent: {
    width: '100%',
    alignItems: 'center',
  },
  iconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 1,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.xxl,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 6,
    paddingTop: 10,
  },
  infoLabel: {
    fontSize: FontSize.sm,
    color: '#64748B',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#1E293B',
  },
  infoValueTotal: {
    fontSize: FontSize.lg,
    fontWeight: '800',
    color: Colors.primary,
  },
  infoValueSub: {
    fontSize: FontSize.sm,
    color: '#475569',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  secondaryBtn: {
    width: '100%',
    height: 52,
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  secondaryBtnText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
