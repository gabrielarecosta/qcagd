import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Animated,
} from 'react-native';
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../types';
import { Colors } from '../constants/Colors';
import { FontSize, FontWeight } from '../constants/Typography';
import { Radius, Spacing } from '../constants/Spacing';
import { formatPrice, formatShortDate, formatTime } from '../utils/formatters';
import { useEntrance } from '../hooks/useEntrance';

interface OrderCardProps {
  order: Order;
  onPress?: (order: Order) => void;
  onRepeat?: (order: Order) => void;
  style?: ViewStyle;
  compact?: boolean;
  delay?: number;
}

export function OrderCard({ order, onPress, onRepeat, style, compact = false, delay = 0 }: OrderCardProps) {
  const statusColor = ORDER_STATUS_COLORS[order.estado];
  const statusLabel = ORDER_STATUS_LABELS[order.estado];
  const totalItems = order.items.reduce((sum, i) => sum + i.cantidad, 0);
  const { animatedStyle } = useEntrance({ delay });
  const deliveryIcon =
    order.deliveryMethod === 'retiro'
      ? '🏪 Retiro'
      : order.deliveryMethod === 'whatsapp'
      ? '💬 WhatsApp'
      : '🚚 Reparto';

  const paymentStatus = order.paymentStatus || (order.paymentMethod === 'mercadopago' ? 'pendiente' : 'pendiente');
  const isPaid = paymentStatus === 'pagado' || paymentStatus === 'approved';
  const paymentBadgeText =
    order.paymentMethod === 'transferencia'
      ? (isPaid ? '🏦 Transf. (Pagado)' : '🏦 Transf. (Pendiente)')
      : order.paymentMethod === 'mercadopago'
      ? (isPaid ? '💳 MP (Pagado)' : '💳 MP (Pendiente)')
      : order.paymentMethod === 'pago_a_acordar'
      ? '🤝 A acordar'
      : order.paymentMethod === 'cuenta_corriente'
      ? '📋 Cta. Cte.'
      : (isPaid ? '💵 Efectivo (Cobrado)' : '💵 Efectivo');

  return (
    <Animated.View style={[animatedStyle]}>
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: statusColor }, style]}
        onPress={() => onPress?.(order)}
        activeOpacity={0.88}
      >
        {/* Cabecera */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.numero}>{order.numero}</Text>
            <Text style={styles.fecha}>{formatShortDate(order.fecha)} • {formatTime(order.fecha)} hs</Text>
          </View>
          <View style={styles.headerBadges}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        {/* Sub-Badges (Entrega y Pago) */}
        <View style={styles.subBadgesRow}>
          <View style={styles.subBadge}>
            <Text style={styles.subBadgeText}>{deliveryIcon}</Text>
          </View>
          <View style={[styles.subBadge, { backgroundColor: isPaid ? '#DCFCE7' : '#FEF3C7' }]}>
            <Text style={[styles.subBadgeText, { color: isPaid ? '#15803D' : '#B45309', fontWeight: 'bold' }]}>
              {paymentBadgeText}
            </Text>
          </View>
        </View>

        {/* Resumen de items */}
        {!compact && (
          <View style={styles.itemsPreview}>
            {order.items.slice(0, 2).map((item, i) => (
              <Text key={i} style={styles.itemPreviewText} numberOfLines={1}>
                • {item.cantidad}x {item.producto.nombre}
              </Text>
            ))}
            {order.items.length > 2 && (
              <Text style={styles.itemPreviewMore}>
                +{order.items.length - 2} productos más
              </Text>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.totalLabel}>{totalItems} artículos • Ver detalle ›</Text>
            <Text style={styles.total}>{formatPrice(order.total)}</Text>
          </View>

          {onRepeat && order.estado === 'entregado' && (
            <TouchableOpacity
              style={styles.repeatButton}
              onPress={(e) => {
                e.stopPropagation();
                onRepeat(order);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.8}
            >
              <Text style={styles.repeatButtonText}>🔄 Repetir</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    // Accent bar izquierdo coloreado según estado del pedido
    borderLeftWidth: 4,
    padding: Spacing.xl,
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  numero: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  fecha: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerBadges: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    gap: 6,
  },
  subBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.md,
  },
  subBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  subBadgeText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  itemsPreview: {
    marginBottom: Spacing.md,
    gap: 3,
  },
  itemPreviewText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  itemPreviewMore: {
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  totalLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  total: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  repeatButton: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  repeatButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
});
