import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  SafeAreaView,
} from 'react-native';
import { customAlert } from '../../utils/alert';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { useAuthStore } from '../../store/authStore';
import { useOrderStore } from '../../store/orderStore';
import { formatPrice } from '../../utils/formatters';
import { mockClients } from '@shared/data';
import { Order } from '../../types';

export function RepartidorHomeScreen() {
  const { repartidorData, logout } = useAuthStore();
  const { orders, updateOrderStatus } = useOrderStore();
  const [driverObs, setDriverObs] = useState<Record<string, string>>({});

  // Filtrar pedidos asignados al repartidor
  const driverOrders = useMemo(() => {
    if (!repartidorData) return [];
    return orders.filter(o => o.repartidorId === repartidorData.id);
  }, [orders, repartidorData]);

  // Contadores
  const stats = useMemo(() => {
    const total = driverOrders.length;
    const completed = driverOrders.filter(o => o.estado === 'entregado').length;
    const pending = driverOrders.filter(o => o.estado !== 'entregado' && o.estado !== 'cancelado').length;
    const failed = driverOrders.filter(o => o.estado === 'cancelado').length;
    return { total, completed, pending, failed };
  }, [driverOrders]);

  const handleSetStatus = (orderId: string, status: any, obs?: string) => {
    updateOrderStatus(orderId, status);
    if (obs) {
      setDriverObs(prev => ({ ...prev, [orderId]: obs }));
    }
    const statusLabel = status === 'entregado' ? 'entregado' : status === 'en_camino' ? 'en viaje' : 'no entregado';
    customAlert('Estado Actualizado', `El pedido fue marcado como ${statusLabel}.`);
  };

  const handleStopFailure = (orderId: string) => {
    customAlert(
      'Marcar como No Entregado',
      'Selecciona el motivo del inconveniente:',
      [
        { text: 'Cliente Ausente', onPress: () => handleSetStatus(orderId, 'cancelado', 'Cliente Ausente') },
        { text: 'Dirección Incorrecta', onPress: () => handleSetStatus(orderId, 'cancelado', 'Dirección Incorrecta') },
        { text: 'Rechazado por Precio', onPress: () => handleSetStatus(orderId, 'cancelado', 'Rechazado por precio') },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
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
    Linking.openURL(`https://wa.me/${waNumber}?text=Hola!%20Te%20escribo%20del%20reparto%20de%20Química%20Deheza.`).catch(() => {
      customAlert('Error', 'No se pudo abrir WhatsApp.');
    });
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
          <Text style={styles.driverSub}>Rol: Chofer Repartidor</Text>
          <View style={[styles.branchBadge, { backgroundColor: '#dcfce7' }]}>
            <Text style={[styles.branchBadgeText, { color: '#16a34a' }]}>
              Sucursal: Química General Deheza
            </Text>
          </View>
        </View>
      </View>

      {/* Resumen e Indicadores */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: Colors.primary }]}>{stats.total}</Text>
          <Text style={styles.statLabel}>Repartos asignados</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: Colors.success }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Entregas completadas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: Colors.warning }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Entregas de hoy</Text>
        </View>
      </View>

      {/* Planilla de Entregas */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Planilla de entregas</Text>

        {driverOrders.length === 0 ? (
          <Text style={styles.emptyText}>No tenés entregas asignadas en esta sucursal.</Text>
        ) : (
          driverOrders.map((o) => {
            const client = mockClients.find(c => c.id === o.clienteId);
            const clientName = client ? client.nombre : 'Cliente Desconocido';
            const clientAddress = client ? client.direccion : 'Sin dirección';
            const clientPhone = client ? client.telefono : '';

            const isCompleted = o.estado === 'entregado';
            const isFailed = o.estado === 'cancelado';
            const isShipping = o.estado === 'en_camino';

            return (
              <View 
                key={o.id} 
                style={[
                  styles.deliveryCard,
                  isCompleted && styles.deliveryCardCompleted,
                  isFailed && styles.deliveryCardFailed,
                  isShipping && styles.deliveryCardShipping,
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.orderNumber}>Pedido #{o.numero}</Text>
                  <View style={[
                    styles.statusBadge,
                    {
                      backgroundColor: isCompleted ? '#dcfce7' : isFailed ? '#fee2e2' : '#fef3c7'
                    }
                  ]}>
                    <Text style={[
                      styles.statusBadgeText,
                      {
                        color: isCompleted ? '#16a34a' : isFailed ? '#dc2626' : '#d97706'
                      }
                    ]}>
                      Estado: {o.estado === 'en_camino' ? 'En reparto' : o.estado === 'en_preparacion' ? 'En preparación' : o.estado === 'pendiente' ? 'Pendiente' : o.estado.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Info Cliente */}
                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Cliente:</Text>
                  <Text style={styles.infoValue}>{clientName}</Text>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Dirección:</Text>
                  <Text style={styles.infoValue}>{clientAddress}</Text>
                </View>

                {clientPhone ? (
                  <View style={styles.infoBlock}>
                    <Text style={styles.infoLabel}>Teléfono / WhatsApp:</Text>
                    <View style={styles.contactRow}>
                      <TouchableOpacity style={styles.contactBtn} onPress={() => handleCall(clientPhone)}>
                        <Text style={styles.contactBtnText}>📞 Llamar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.contactBtn, { backgroundColor: '#25D366' }]} onPress={() => handleWhatsApp(clientPhone)}>
                        <Text style={styles.contactBtnText}>💬 WhatsApp</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Método de pago:</Text>
                  <Text style={[styles.infoValue, { fontWeight: 'bold' }]}>{(o.paymentMethod || 'Efectivo').toUpperCase()}</Text>
                </View>

                <View style={styles.infoBlock}>
                  <Text style={styles.infoLabel}>Monto total:</Text>
                  <Text style={[styles.infoValue, { fontSize: FontSize.lg, color: Colors.primary, fontWeight: 'bold' }]}>
                    {formatPrice(o.total)}
                  </Text>
                </View>

                {o.abonaCon && (
                  <View style={styles.vueltoBox}>
                    <Text style={styles.vueltoLabel}>Abona con: {formatPrice(o.abonaCon)}</Text>
                    <Text style={styles.vueltoValue}>Dar vuelto de: {formatPrice(o.cambioEstimado || 0)}</Text>
                  </View>
                )}

                {/* Observaciones registradas */}
                {(driverObs[o.id] || o.estado === 'cancelado') && (
                  <View style={styles.obsBox}>
                    <Text style={styles.obsTitle}>Observaciones:</Text>
                    <Text style={styles.obsText}>
                      {driverObs[o.id] || 'Inconveniente en la entrega del reparto'}
                    </Text>
                  </View>
                )}

                {/* Botones de acción */}
                {!isCompleted && !isFailed && (
                  <View style={styles.actionButtonsCol}>
                    {o.estado !== 'en_camino' && (
                      <TouchableOpacity 
                        style={[styles.actionButton, { backgroundColor: Colors.primary }]}
                        onPress={() => handleSetStatus(o.id, 'en_camino')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.actionButtonText}>🚚 Marcar en camino</Text>
                      </TouchableOpacity>
                    )}

                    {o.estado === 'en_camino' && (
                      <View style={styles.actionButtonRow}>
                        <TouchableOpacity 
                          style={[styles.actionButton, { backgroundColor: Colors.success, flex: 1.2 }]}
                          onPress={() => handleSetStatus(o.id, 'entregado')}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.actionButtonText}>✔ Marcar entregado</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={[styles.actionButton, { backgroundColor: Colors.danger, flex: 1 }]}
                          onPress={() => handleStopFailure(o.id)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.actionButtonText}>❌ No entregado</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* Cerrar Sesión */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.8}>
        <Text style={styles.logoutButtonText}>Cerrar sesión repartidor</Text>
      </TouchableOpacity>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Química Deheza · Repartos Móviles</Text>
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
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    borderBottomWidth: 1,
    borderBottomColor: '#bbf7d0',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 34,
  },
  headerInfo: {
    flex: 1,
    gap: 4,
  },
  driverName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  driverSub: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  branchBadge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 4,
  },
  branchBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statNumber: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
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
  deliveryCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  deliveryCardCompleted: {
    borderColor: Colors.success,
    borderLeftWidth: 6,
    borderLeftColor: Colors.success,
  },
  deliveryCardFailed: {
    borderColor: Colors.danger,
    borderLeftWidth: 6,
    borderLeftColor: Colors.danger,
  },
  deliveryCardShipping: {
    borderColor: Colors.primary,
    borderLeftWidth: 6,
    borderLeftColor: Colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
  },
  orderNumber: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  statusBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  infoBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  infoLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    flex: 1.2,
  },
  infoValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flex: 2,
    textAlign: 'right',
  },
  contactRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flex: 2,
    justifyContent: 'flex-end',
  },
  contactBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
  },
  contactBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: FontSize.sm,
  },
  vueltoBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: 2,
  },
  vueltoLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  vueltoValue: {
    fontSize: FontSize.md,
    fontWeight: 'bold',
    color: Colors.success,
  },
  obsBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  obsTitle: {
    fontSize: FontSize.sm,
    fontWeight: 'bold',
    color: Colors.danger,
    marginBottom: 2,
  },
  obsText: {
    fontSize: FontSize.md,
    fontStyle: 'italic',
    color: Colors.danger,
  },
  actionButtonsCol: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  actionButton: {
    height: 56,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  actionButtonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
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
