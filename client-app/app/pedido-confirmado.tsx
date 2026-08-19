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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '../components/icons/MaterialCommunityIcons';
import { Colors } from '../constants/Colors';
import { FontSize, FontWeight } from '../constants/Typography';
import { Radius, Spacing } from '../constants/Spacing';
import { Button } from '../components/ui/Button';
import { companySettingsService } from '@shared/services/companySettingsService';
import { formatPrice } from '../utils/formatters';

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
  const params = useLocalSearchParams<{
    orderNum?: string;
    orderTotal?: string;
    deliveryMethod?: string;
    paymentMethod?: string;
    deliveryDate?: string;
    slotNombre?: string;
    slotHoraInicio?: string;
    slotHoraFin?: string;
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

  const selectedOption = DELIVERY_OPTIONS[deliveryMethod] || DELIVERY_OPTIONS['reparto'];
  const paymentLabel =
    paymentMethod === 'efectivo'
      ? 'Efectivo / Contra entrega'
      : paymentMethod === 'mercadopago'
      ? 'Mercado Pago'
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
    const waText = encodeURIComponent(
      `*Comprobante de Pago — Química Deheza*\n` +
      `Hola! Acabo de realizar la transferencia para mi pedido *${orderNum}*\n` +
      `*Monto:* ${formatPrice(orderTotal)}\n` +
      `Adjunto aquí abajo la captura del comprobante bancario.`
    );
    const targetNumber = companySettings?.whatsapp || '5493511234567';
    Linking.openURL(`https://wa.me/${targetNumber}?text=${waText}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
});
