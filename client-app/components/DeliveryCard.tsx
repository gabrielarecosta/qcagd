import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { DeliveryTracking } from '../types';
import { Colors } from '../constants/Colors';
import { FontSize, FontWeight } from '../constants/Typography';
import { Radius, Spacing } from '../constants/Spacing';
import { useOrderStore } from '../store/orderStore';

interface DeliveryCardProps {
  delivery: DeliveryTracking;
}

const STEPS = [
  { estado: 'pendiente', label: 'Pedido recibido', icon: '📋' },
  { estado: 'en_preparacion', label: 'En preparación', icon: '📦' },
  { estado: 'en_camino', label: 'En reparto', icon: '🚚' },
  { estado: 'entregado', label: 'Entregado', icon: '✅' },
];

const STATUS_INDEX: Record<string, number> = {
  pendiente: 0,
  en_preparacion: 1,
  en_camino: 2,
  entregado: 3,
};

export function DeliveryCard({ delivery }: DeliveryCardProps) {
  const currentStep = STATUS_INDEX[delivery.estado] ?? 0;
  
  // Buscar el pedido en el store para obtener el número de pedido real
  const order = useOrderStore((state) => state.orders.find((o) => o.id === delivery.orderId));
  const orderNum = order ? order.numero : 'PED-0000';

  const handleCallDeliverer = () => {
    Linking.openURL(`tel:${delivery.repartidor.telefono}`);
  };

  const handleWhatsAppDeliverer = () => {
    const text = encodeURIComponent(
      `Hola! Consulto por el estado del reparto de mi pedido ${orderNum}.`
    );
    Linking.openURL(`https://wa.me/5493511234567?text=${text}`);
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.delivererInfo}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {delivery.repartidor.nombre.charAt(0)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.delivererLabel}>Tu repartidor</Text>
            <Text style={styles.delivererName}>{delivery.repartidor.nombre}</Text>
            <Text style={styles.delivererVehicle} numberOfLines={1}>
              {delivery.repartidor.vehiculo}
            </Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.callButton} onPress={handleCallDeliverer}>
            <Text style={styles.callButtonText}>📞 Llamar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.whatsappButton} onPress={handleWhatsAppDeliverer}>
            <Text style={styles.whatsappButtonText}>💬 WhatsApp</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.timeline}>
        {STEPS.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <View key={step.estado} style={styles.timelineItem}>
              {/* Línea vertical */}
              {index < STEPS.length - 1 && (
                <View
                  style={[
                    styles.timelineLine,
                    isCompleted && styles.timelineLineCompleted,
                  ]}
                />
              )}

              {/* Dot */}
              <View
                style={[
                  styles.timelineDot,
                  isCompleted && styles.timelineDotCompleted,
                  isCurrent && styles.timelineDotCurrent,
                ]}
              >
                {isCompleted ? (
                  <Text style={styles.timelineCheck}>✓</Text>
                ) : (
                  <Text style={[styles.timelineEmoji, isUpcoming && styles.timelineEmojiUpcoming]}>
                    {step.icon}
                  </Text>
                )}
              </View>

              {/* Label */}
              <View style={styles.timelineLabelContainer}>
                <Text
                  style={[
                    styles.timelineLabel,
                    isCurrent && styles.timelineLabelCurrent,
                    isUpcoming && styles.timelineLabelUpcoming,
                  ]}
                >
                  {step.label}
                </Text>
                {isCurrent && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Ahora</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  delivererInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  delivererLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  delivererName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  delivererVehicle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  delivererZone: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
    marginTop: 2,
  },
  actionsContainer: {
    gap: Spacing.sm,
    alignItems: 'stretch',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.successLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
    minWidth: 100,
  },
  callButtonText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.success,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7', // Light green WhatsApp-like
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.md,
    minWidth: 100,
  },
  whatsappButtonText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#16A34A',
  },
  timeline: {
    paddingLeft: Spacing.sm,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 18,
    top: 38,
    width: 2,
    height: Spacing.xl + Spacing.md,
    backgroundColor: Colors.border,
  },
  timelineLineCompleted: {
    backgroundColor: Colors.success,
  },
  timelineDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.lg,
  },
  timelineDotCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  timelineDotCurrent: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
    borderWidth: 2.5,
  },
  timelineCheck: {
    fontSize: FontSize.lg,
    color: Colors.white,
    fontWeight: FontWeight.bold,
  },
  timelineEmoji: {
    fontSize: 18,
  },
  timelineEmojiUpcoming: {
    opacity: 0.4,
  },
  timelineLabelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    gap: Spacing.md,
  },
  timelineLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  timelineLabelCurrent: {
    color: Colors.primary,
  },
  timelineLabelUpcoming: {
    color: Colors.textDisabled,
    fontWeight: FontWeight.regular,
  },
  currentBadge: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  currentBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
});
