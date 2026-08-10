import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Linking,
  Image,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from '../../components/icons/MaterialCommunityIcons';import { customAlert } from '../../utils/alert';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing, TouchTarget } from '../../constants/Spacing';
import { mockDeliverers } from '../../data/deliveries';
import { DeliveryCard } from '../../components/DeliveryCard';
import { DeliveryTracking, Order, OrderStatus } from '../../types';
import { formatDate } from '../../utils/formatters';
import { useOrderStore } from '../../store/orderStore';
import { currentCustomer } from '../../data/customers';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { useRouter } from 'expo-router';
import { mockClients } from '@shared/data';
import { supabase } from '@shared/services/supabaseClient';

import { Platform, useWindowDimensions } from 'react-native';
import { DesktopStartScreen } from '../../components/screens/DesktopStartScreen';
import { MobileStartScreen } from '../../components/screens/MobileStartScreen';

export default function RepartoScreen() {
  const { orders, updateOrderStatus, fetchOrders, takeOrder } = useOrderStore();
  const { isLoggedIn, userRole, clientData, repartidorData } = useAuthStore();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  if (!isLoggedIn) {
    return isDesktop ? <DesktopStartScreen /> : <MobileStartScreen />;
  }

  const [repartoTab, setRepartoTab] = React.useState<'disponibles' | 'mis_pedidos'>('mis_pedidos');
  const [refreshing, setRefreshing] = React.useState(false);

  const [activeRoute, setActiveRoute] = React.useState<any | null>(null);
  const [routeStops, setRouteStops] = React.useState<any[]>([]);
  const [loadingRoute, setLoadingRoute] = React.useState(false);

  const fetchActiveRoute = React.useCallback(async () => {
    if (!repartidorData) return;
    setLoadingRoute(true);
    try {
      const { data: route, error: routeErr } = await supabase
        .from('delivery_routes')
        .select('*')
        .eq('repartidor_id', repartidorData.id)
        .in('estado', ['armado', 'en_camino'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (routeErr) throw routeErr;

      if (route) {
        route.status = route.status || (route.estado === 'armado' ? 'confirmed' : 'active');
        setActiveRoute(route);
        const { data: stops, error: stopsErr } = await supabase
          .from('delivery_route_stops')
          .select(`
            *,
            order:orders (
              *,
              cliente:customers (*)
            )
          `)
          .eq('route_id', route.id)
          .order('stop_position', { ascending: true });

        if (stopsErr) throw stopsErr;
        setRouteStops(stops || []);
      } else {
        setActiveRoute(null);
        setRouteStops([]);
      }
    } catch (err) {
      console.warn('Error fetching active route (waiting for migrations to run):', err);
    } finally {
      setLoadingRoute(false);
    }
  }, [repartidorData]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      if (userRole === 'repartidor' && repartidorData) {
        await fetchOrders(undefined, undefined);
        await fetchActiveRoute();
      } else if (userRole === 'cliente' && clientData) {
        await fetchOrders(clientData.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  }, [userRole, clientData, repartidorData, fetchActiveRoute]);

  React.useEffect(() => {
    if (isLoggedIn) {
      if (userRole === 'repartidor' && repartidorData) {
        fetchOrders(undefined, undefined);
        fetchActiveRoute();
      } else if (userRole === 'cliente' && clientData) {
        fetchOrders(clientData.id);
      }
    }
  }, [isLoggedIn, userRole, clientData, repartidorData, fetchActiveRoute]);

  const [repartidores, setRepartidores] = React.useState<any[]>([]);

  React.useEffect(() => {
    const loadRepartidores = async () => {
      const { data } = await supabase
        .from('drivers')
        .select('id, profiles(nombre)')
        .eq('activo', true);
      if (data) {
        const mapped = data.map((d: any) => ({
          id: d.id,
          nombre: d.profiles?.nombre || 'Chofer sin nombre'
        }));
        setRepartidores(mapped);
      }
    };
    if (isLoggedIn && userRole === 'repartidor') {
      loadRepartidores();
    }
  }, [isLoggedIn, userRole]);

  const role = userRole || 'cliente';

  // Pedidos activos en el cliente (pendiente, preparando o en camino)
  const activeClientOrders = orders.filter(
    (o) => o.estado === 'en_camino' || o.estado === 'en_preparacion' || o.estado === 'pendiente'
  );

  // Pedidos ya entregados para el historial
  const deliveredOrders = orders.filter((o) => o.estado === 'entregado');

  // Todos los pedidos activos a entregar o tomar (no entregados ni cancelados)
  const availableOrders = orders.filter(
    (o) => o.estado !== 'entregado' && o.estado !== 'cancelado'
  );

  // Pedidos tomados por el repartidor actual (activos)
  const activeDelivererOrders = orders.filter(
    (o) =>
      (repartidorData && o.repartidorId === repartidorData.id) &&
      (o.estado === 'en_camino' || o.estado === 'en_preparacion' || o.estado === 'pendiente' || o.estado === 'recibido' || o.estado === 'listo_para_reparto')
  );

  const handleTakeOrder = async (orderId: string) => {
    if (!repartidorData) return;
    try {
      await takeOrder(orderId, repartidorData.id);
      customAlert('Pedido tomado', 'Tomaste este pedido para tu reparto.');
    } catch (e) {
      customAlert('Error', 'No se pudo tomar el pedido.');
    }
  };

  // Función para construir datos de tracking simulados basados en cada pedido
  const getOrderTracking = (order: Order): DeliveryTracking => {
    return {
      id: `tracking-${order.id}`,
      orderId: order.id,
      repartidor: mockDeliverers.find((d) => d.id === order.repartidorId) || mockDeliverers[0],
      estado: order.estado,
      horaEstimada: order.deliveryStartTime && order.deliveryEndTime
        ? `${order.deliveryStartTime} a ${order.deliveryEndTime}`
        : '14:30',
      paradas: [
        {
          clienteId: 'other-1',
          clienteNombre: 'Cliente 1',
          direccion: 'Zona Centro (Entrega anterior)',
          completado: true,
        },
        {
          clienteId: 'other-2',
          clienteNombre: 'Cliente 2',
          direccion: 'Zona Industrial (Entrega anterior)',
          completado: order.estado === 'entregado',
        },
        {
          clienteId: clientData?.id || 'cli-1',
          clienteNombre: clientData?.nombre || currentCustomer.nombre,
          direccion: clientData?.direccion || currentCustomer.direccion,
          completado: order.estado === 'entregado',
        },
      ],
    };
  };

  const handleStartDelivery = (orderId: string) => {
    updateOrderStatus(orderId, 'en_camino');
    customAlert('Reparto iniciado', 'El pedido cambió a estado "En camino"');
  };

  const handleMarkAsDelivered = (orderId: string) => {
    updateOrderStatus(orderId, 'entregado');
    customAlert('Entregado', 'El pedido fue marcado como entregado con éxito.');
  };

  const handleStopFailure = (orderId: string) => {
    customAlert(
      'Marcar como No Entregado',
      'Selecciona el motivo del inconveniente:',
      [
        { text: 'Cliente Ausente', onPress: () => updateOrderStatus(orderId, 'cancelado') },
        { text: 'Dirección Incorrecta', onPress: () => updateOrderStatus(orderId, 'cancelado') },
        { text: 'Rechazado por Precio', onPress: () => updateOrderStatus(orderId, 'cancelado') },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`);
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const waNumber = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
    Linking.openURL(`https://wa.me/${waNumber}?text=Hola!%20Te%20escribo%20del%20reparto%20de%20Química%20Deheza.`);
  };

  const handleStartRoute = async () => {
    if (!activeRoute) return;
    try {
      await supabase
        .from('delivery_routes')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', activeRoute.id);

      const firstStop = routeStops.find(s => s.stop_position === 1);
      if (firstStop) {
        await supabase
          .from('delivery_route_stops')
          .update({ status: 'next' })
          .eq('id', firstStop.id);
      }

      customAlert('¡Recorrido Iniciado!', 'Comenzaste la hoja de ruta.');
      await fetchActiveRoute();
      await fetchOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopArrived = async (stopId: string) => {
    try {
      await supabase
        .from('delivery_route_stops')
        .update({ status: 'arrived', actual_arrival_at: new Date().toISOString() })
        .eq('id', stopId);
      customAlert('Llegada Registrada', 'Marcaste que llegaste al domicilio.');
      await fetchActiveRoute();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopDelivered = async (stopId: string, orderId: string, stopPosition: number) => {
    try {
      await supabase
        .from('delivery_route_stops')
        .update({ status: 'delivered', delivered_at: new Date().toISOString() })
        .eq('id', stopId);

      await supabase
        .from('orders')
        .update({ estado: 'entregado', delivery_status: 'delivered' })
        .eq('id', orderId);

      const nextStop = routeStops.find(s => s.stop_position === stopPosition + 1);
      if (nextStop) {
        await supabase
          .from('delivery_route_stops')
          .update({ status: 'next' })
          .eq('id', nextStop.id);
      } else {
        await supabase
          .from('delivery_routes')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', activeRoute.id);
      }

      customAlert('✔ Entrega exitosa', 'Se registró la entrega correctamente.');
      await fetchActiveRoute();
      await fetchOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopFailed = (stopId: string, orderId: string, stopPosition: number) => {
    customAlert(
      'Inconveniente con la entrega',
      'Selecciona el motivo de la falla:',
      [
        { text: 'Cliente Ausente', onPress: () => submitStopFailure(stopId, orderId, stopPosition, 'Cliente Ausente') },
        { text: 'Dirección Incorrecta', onPress: () => submitStopFailure(stopId, orderId, stopPosition, 'Dirección Incorrecta') },
        { text: 'Rechazado por Precio', onPress: () => submitStopFailure(stopId, orderId, stopPosition, 'Rechazado por Precio') },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  const submitStopFailure = async (stopId: string, orderId: string, stopPosition: number, reason: string) => {
    try {
      await supabase
        .from('delivery_route_stops')
        .update({ status: 'failed', failure_reason: reason })
        .eq('id', stopId);

      await supabase
        .from('orders')
        .update({ estado: 'cancelado', delivery_status: 'failed' })
        .eq('id', orderId);

      const nextStop = routeStops.find(s => s.stop_position === stopPosition + 1);
      if (nextStop) {
        await supabase
          .from('delivery_route_stops')
          .update({ status: 'next' })
          .eq('id', nextStop.id);
      }

      customAlert('Falla registrada', `Se guardó el inconveniente: "${reason}".`);
      await fetchActiveRoute();
      await fetchOrders();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopRescheduled = async (stopId: string, orderId: string, stopPosition: number) => {
    try {
      await supabase
        .from('delivery_route_stops')
        .update({ status: 'rescheduled' })
        .eq('id', stopId);

      await supabase
        .from('orders')
        .update({ estado: 'reprogramado', delivery_status: 'skipped' })
        .eq('id', orderId);

      const nextStop = routeStops.find(s => s.stop_position === stopPosition + 1);
      if (nextStop) {
        await supabase
          .from('delivery_route_stops')
          .update({ status: 'next' })
          .eq('id', nextStop.id);
      }

      customAlert('Pedido Reprogramado', 'El pedido fue asignado para reprogramación.');
      await fetchActiveRoute();
      await fetchOrders();
    } catch (e) {
      console.error(e);
    }
  };

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.guestContainer}>
          <Text style={styles.guestIcon}>🚚</Text>
          <Text style={styles.guestTitle}>Seguimiento de Reparto</Text>
          <Text style={styles.guestText}>
            Iniciá sesión con tu cuenta para consultar el estado de tu reparto, chofer asignado y zona en tiempo real.
          </Text>
          <TouchableOpacity
            style={styles.guestButton}
            onPress={() => router.push('/(tabs)/cuenta')}
            activeOpacity={0.8}
          >
            <Text style={styles.guestButtonText}>Ir a Mi Cuenta</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Cabecera de Repartos */}
      <View style={styles.roleSelectorHeader}>
        <Text style={styles.headerTitle}>
          {role === 'repartidor' ? 'Planilla de Reparto' : 'Estado de mi Reparto'}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ========================================== */}
        {/* VISTA CLIENTE */}
        {/* ========================================== */}
        {role === 'cliente' && (
          <View>
            {activeClientOrders.length > 0 ? (
              activeClientOrders.map((order) => {
                const tracking = getOrderTracking(order);
                return (
                  <View key={order.id} style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.activeBadge}>
                        <View
                          style={[
                            styles.activeDot,
                            {
                              backgroundColor:
                                order.estado === 'en_camino'
                                  ? Colors.statusOnTheWay
                                  : order.estado === 'en_preparacion'
                                    ? Colors.primary
                                    : '#D97706',
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.activeBadgeText,
                            {
                              color:
                                order.estado === 'en_camino'
                                  ? Colors.statusOnTheWay
                                  : order.estado === 'en_preparacion'
                                    ? Colors.primary
                                    : '#D97706',
                            },
                          ]}
                        >
                          {order.estado === 'en_camino'
                            ? 'En camino'
                            : order.estado === 'en_preparacion'
                              ? 'En preparación'
                              : 'Recibido'}
                        </Text>
                      </View>
                      <Text style={styles.sectionTitle}>{order.numero}</Text>
                      <Text style={styles.sectionSubtitle}>
                        {formatDate(order.fecha)}
                      </Text>
                    </View>

                    {/* Mostrar franja horaria programada si existe */}
                    {order.deliveryDate && order.deliveryStartTime && (
                      <View style={{ marginBottom: Spacing.md, paddingHorizontal: Spacing.sm }}>
                        <Text style={{ fontSize: 13, color: Colors.textSecondary }}>
                          📅 Entrega programada: <Text style={{ fontWeight: 'bold', color: Colors.textPrimary }}>{order.deliveryDate}</Text> de {order.deliveryStartTime} a {order.deliveryEndTime} hs
                        </Text>
                      </View>
                    )}

                    <DeliveryCard delivery={tracking} />
                  </View>
                );
              })
            ) : (
              <View style={styles.noActiveDelivery}>
                <Text style={styles.noDeliveryIcon}>📦</Text>
                <Text style={styles.noDeliveryTitle}>No tenés repartos activos</Text>
                <Text style={styles.noDeliverySubtitle}>
                  Cuando realices un pedido por envío, vas a poder seguir el estado de tu reparto desde acá.
                </Text>
              </View>
            )}

            {/* Historial de repartos */}
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>Historial de entregas</Text>

              {deliveredOrders.length === 0 ? (
                <View style={styles.emptyHistoryCard}>
                  <Text style={styles.emptyHistoryText}>No tenés entregas completadas todavía.</Text>
                </View>
              ) : (
                deliveredOrders.map((order) => (
                  <View key={order.id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyNumero}>{order.numero}</Text>
                      <Text style={styles.historyFecha}>{formatDate(order.fecha)}</Text>
                    </View>
                    <View style={styles.historyDeliverer}>
                      {order.repartidorId && (
                        <>
                          <Text style={styles.historyDelivererLabel}>Repartidor: </Text>
                          <Text style={styles.historyDelivererName}>
                            {mockDeliverers.find((d) => d.id === order.repartidorId)?.nombre ??
                              'Desconocido'}
                          </Text>
                        </>
                      )}
                    </View>
                    <View style={styles.historyStatus}>
                      <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
                      <Text style={styles.historyStatusText}>Entregado</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* ========================================== */}
        {/* VISTA REPARTIDOR */}
        {/* ========================================== */}
        {role === 'repartidor' && (
          <View style={styles.repartidorSection}>
            <View style={[styles.repartidorMetaCard, { flexDirection: 'row', alignItems: 'center', padding: 16 }]}>
              <View>
                {repartidorData?.fotoUrl ? (
                  <Image source={{ uri: repartidorData.fotoUrl }} style={{ width: 60, height: 60, borderRadius: 30, marginRight: 16 }} />
                ) : (
                  <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                    <MaterialCommunityIcons name="account" size={32} color={Colors.primary} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <><Text style={styles.repartidorMetaTitle}>{repartidorData?.nombre || 'Chofer Repartidor'}</Text>
                  <Text style={styles.repartidorMetaSub}>
                    {repartidorData?.auto && repartidorData?.patente
                      ? `${repartidorData.auto} · Patente: ${repartidorData.patente}`
                      : (repartidorData?.branchId === 'branch-gd1'
                        ? 'Camioneta Ford Transit · Patente AB 123 CD'
                        : 'Camioneta Renault Kangoo · Patente XY 789 ZW')}
                  </Text>
                  {repartidorData?.dni && (
                    <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>DNI: {repartidorData.dni}</Text>
                  )}
                  <View style={[styles.repartidorZoneTag, { alignSelf: 'flex-start', marginTop: 6 }]}>
                    <Text style={styles.repartidorZoneTagText}>
                      Sucursal: Química General Deheza
                    </Text>
                  </View>
                </>
              </View>
            </View>

            {/* Selector de Pestañas Operativas del Repartidor */}
            <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: Radius.md, padding: 4, marginBottom: Spacing.lg }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: Radius.sm,
                  alignItems: 'center',
                  backgroundColor: repartoTab === 'mis_pedidos' ? '#fff' : 'transparent',
                }}
                onPress={() => setRepartoTab('mis_pedidos')}
              >
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: repartoTab === 'mis_pedidos' ? Colors.textPrimary : '#64748b' }}>
                  Mis Entregas ({activeDelivererOrders.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: Radius.sm,
                  alignItems: 'center',
                  backgroundColor: repartoTab === 'disponibles' ? '#fff' : 'transparent',
                }}
                onPress={() => setRepartoTab('disponibles')}
              >
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: repartoTab === 'disponibles' ? Colors.textPrimary : '#64748b' }}>
                  Disponibles ({availableOrders.length})
                </Text>
              </TouchableOpacity>
            </View>

            {repartoTab === 'mis_pedidos' ? (
              <>
                {activeRoute ? (
                  <View style={{ gap: Spacing.md }}>
                    {/* Header general de la Hoja de Ruta */}
                    <View style={{ backgroundColor: 'white', padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 5, borderLeftColor: Colors.primary }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.textPrimary }}>
                        Hoja de Ruta: {activeRoute.route_number}
                      </Text>
                      <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                        Estado: <Text style={{ fontWeight: 'bold', color: activeRoute.status === 'confirmed' ? '#D97706' : Colors.success }}>
                          {activeRoute.status === 'confirmed' ? 'Confirmada (Pendiente de inicio)' : 'En Progreso / Activa'}
                        </Text>
                      </Text>
                      <Text style={{ fontSize: 13, color: '#64748b' }}>
                        Paradas totales: {routeStops.length} | Distancia estimada: {((activeRoute.total_distance_meters || 0) / 1000).toFixed(1)} km
                      </Text>

                      {activeRoute.status === 'confirmed' && (
                        <TouchableOpacity
                          style={{ height: 46, backgroundColor: Colors.primary, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md }}
                          onPress={handleStartRoute}
                        >
                          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>🚀 Iniciar Recorrido</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Secuencia paso a paso de paradas */}
                    <View style={{ gap: Spacing.md }}>
                      {routeStops.map((stop, idx) => {
                        const customer = stop.order?.cliente || currentCustomer;
                        const isCompleted = stop.status === 'delivered';
                        const isFailed = stop.status === 'failed' || stop.status === 'rescheduled';
                        const isCurrent = stop.status === 'next' || stop.status === 'arrived';

                        // Local fallback map for order item products if not fully loaded
                        const orderItemProducts = stop.order?.items || [];

                        return (
                          <View
                            key={stop.id}
                            style={[
                              styles.orderDelivererCard,
                              {
                                borderLeftWidth: 5,
                                borderLeftColor: isCompleted
                                  ? Colors.success
                                  : isFailed
                                    ? Colors.danger
                                    : (isCurrent ? '#0ea5e9' : '#e2e8f0'),
                                opacity: isCompleted ? 0.75 : 1,
                                padding: Spacing.md,
                                marginVertical: 0
                              },
                            ]}
                          >
                            {/* Número de parada y estado */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View
                                  style={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: 12,
                                    backgroundColor: isCompleted ? Colors.success : (isFailed ? Colors.danger : (isCurrent ? '#0ea5e9' : '#64748b')),
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{idx + 1}</Text>
                                </View>
                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: Colors.textPrimary }}>
                                  {idx === 0 ? '1ª Parada (Inicio)' : `Parada Nº ${idx + 1}`}
                                </Text>
                              </View>
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: 'bold',
                                  color: isCompleted ? Colors.success : (isFailed ? Colors.danger : (isCurrent ? '#0ea5e9' : '#64748b')),
                                }}
                              >
                                {isCompleted ? 'ENTREGADO' : (isFailed ? 'NO ENTREGADO' : (isCurrent ? 'ACTUAL' : 'PENDIENTE'))}
                              </Text>
                            </View>

                            {/* Datos del comprador y Dirección */}
                            <View style={{ marginVertical: 4 }}>
                              <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.primary }}>
                                {customer.nombre}
                              </Text>
                              <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>
                                📍 Dirección: <Text style={{ color: Colors.textPrimary, fontWeight: 'bold' }}>{customer.direccion}</Text>
                              </Text>
                              {stop.order?.address_reference ? (
                                <Text style={{ fontSize: 12, color: '#0ea5e9', fontStyle: 'italic', marginTop: 1 }}>
                                  ℹ Referencia: {stop.order.address_reference}
                                </Text>
                              ) : null}
                            </View>

                            {/* Listado de Productos */}
                            {orderItemProducts && orderItemProducts.length > 0 && (
                              <View style={{ backgroundColor: '#f8fafc', padding: Spacing.sm, borderRadius: Radius.sm, marginTop: Spacing.xs, marginBottom: Spacing.sm }}>
                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 2 }}>📦 Productos a entregar:</Text>
                                {orderItemProducts.map((item: any, itemIdx: number) => (
                                  <Text key={itemIdx} style={{ fontSize: 12, color: Colors.textPrimary }}>
                                    • {item.cantidad} x {item.producto?.nombre} {item.producto?.presentacion ? `(${item.producto.presentacion})` : ''}
                                  </Text>
                                ))}
                              </View>
                            )}

                            {/* Resumen de cobros */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: Spacing.sm, marginTop: Spacing.xs }}>
                              <Text style={{ fontSize: 12, color: '#64748b' }}>
                                Pago: <Text style={{ fontWeight: 'bold', color: Colors.textPrimary }}>{(stop.order?.paymentMethod || 'Efectivo').toUpperCase()}</Text>
                              </Text>
                              <Text style={{ fontSize: 13, fontWeight: 'bold', color: Colors.primary }}>
                                Importe: ${(stop.order?.total || 0).toLocaleString('es-AR')}
                              </Text>
                            </View>
                            {stop.order?.abonaCon ? (
                              <View style={{ backgroundColor: '#f0fdf4', padding: 6, borderRadius: Radius.sm, marginTop: 6 }}>
                                <Text style={{ fontSize: 11, color: '#16a34a' }}>
                                  Abona con: ${stop.order.abonaCon.toLocaleString('es-AR')} | Vuelto sugerido: ${(stop.order.cambioEstimado || 0).toLocaleString('es-AR')}
                                </Text>
                              </View>
                            ) : null}

                            {/* Controles y Navegación GPS */}
                            {!isCompleted && !isFailed && (
                              <View style={{ marginTop: Spacing.md, gap: 8 }}>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                  <TouchableOpacity
                                    style={{ flex: 1.2, height: 42, backgroundColor: '#0ea5e9', borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 }}
                                    onPress={() => {
                                      const url = `https://www.google.com/maps/search/?api=1&query=${stop.latitude},${stop.longitude}`;
                                      Linking.openURL(url);
                                    }}
                                  >
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>🧭 Abrir Navegación GPS</Text>
                                  </TouchableOpacity>

                                  {customer.telefono && (
                                    <TouchableOpacity
                                      style={{ height: 42, width: 44, backgroundColor: '#f1f5f9', borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' }}
                                      onPress={() => handleCall(customer.telefono)}
                                    >
                                      <Text style={{ fontSize: 16 }}>📞</Text>
                                    </TouchableOpacity>
                                  )}
                                  {customer.telefono && (
                                    <TouchableOpacity
                                      style={{ height: 42, width: 44, backgroundColor: '#25D366' + '15', borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' }}
                                      onPress={() => handleWhatsApp(customer.telefono)}
                                    >
                                      <Text style={{ fontSize: 16 }}>💬</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>

                                {/* Acciones operativas exclusivas de la parada actual activa */}
                                {activeRoute.status === 'active' && isCurrent && (
                                  <View style={{ gap: 6, marginTop: 4 }}>
                                    {stop.status === 'next' ? (
                                      <TouchableOpacity
                                        style={{ height: 44, backgroundColor: Colors.primary, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' }}
                                        onPress={() => handleStopArrived(stop.id)}
                                      >
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>📍 Marcar Llegada al Domicilio</Text>
                                      </TouchableOpacity>
                                    ) : (
                                      <>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                          <TouchableOpacity
                                            style={{ flex: 1.3, height: 44, backgroundColor: Colors.success, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' }}
                                            onPress={() => handleStopDelivered(stop.id, stop.order_id, stop.stop_position)}
                                          >
                                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>✔ Registrar Entregado</Text>
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            style={{ flex: 1, height: 44, backgroundColor: Colors.danger, borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' }}
                                            onPress={() => handleStopFailed(stop.id, stop.order_id, stop.stop_position)}
                                          >
                                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>❌ Inconveniente</Text>
                                          </TouchableOpacity>
                                        </View>
                                        <TouchableOpacity
                                          style={{ height: 38, backgroundColor: '#f1f5f9', borderRadius: Radius.sm, justifyContent: 'center', alignItems: 'center' }}
                                          onPress={() => handleStopRescheduled(stop.id, stop.order_id, stop.stop_position)}
                                        >
                                          <Text style={{ color: Colors.textPrimary, fontWeight: 'bold', fontSize: 12 }}>📅 Reprogramar para otro día</Text>
                                        </TouchableOpacity>
                                      </>
                                    )}
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={styles.sectionTitleList}>Hojas de Ruta Asignadas ({activeDelivererOrders.length})</Text>

                    {activeDelivererOrders.length === 0 ? (
                      <View style={styles.noActiveDelivery}>
                        <Text style={styles.noDeliveryIcon}>🎉</Text>
                        <Text style={styles.noDeliveryTitle}>¡Sin entregas pendientes!</Text>
                        <Text style={styles.noDeliverySubtitle}>
                          No tenés repartos activos tomados. Cambiá a la pestaña "Disponibles" para tomar un nuevo pedido.
                        </Text>
                      </View>
                    ) : (
                      activeDelivererOrders.map((order) => {
                        const client = mockClients.find((c) => c.id === order.clienteId);
                        const customer = client || currentCustomer;
                        return (
                          <View key={order.id} style={styles.orderDelivererCard}>
                            <View style={styles.orderDelivererHeader}>
                              <View>
                                <Text style={styles.orderDelivererNum}>Pedido #{order.numero}</Text>
                                {order.takenAt && (
                                  <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                    Tomado: {new Date(order.takenAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                                  </Text>
                                )}
                              </View>
                              <View
                                style={[
                                  styles.statusBadge,
                                  {
                                    backgroundColor:
                                      order.estado === 'en_camino'
                                        ? Colors.statusOnTheWay + '15'
                                        : order.estado === 'en_preparacion'
                                          ? Colors.primary + '15'
                                          : '#D9770615',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.statusBadgeText,
                                    {
                                      color:
                                        order.estado === 'en_camino'
                                          ? Colors.statusOnTheWay
                                          : order.estado === 'en_preparacion'
                                            ? Colors.primary
                                            : '#D97706',
                                    },
                                  ]}
                                >
                                  {order.estado === 'en_camino'
                                    ? 'En Reparto'
                                    : order.estado === 'en_preparacion'
                                      ? 'En Preparación'
                                      : 'Recibido'}
                                </Text>
                              </View>
                            </View>

                            <View style={styles.orderDelivererBody}>
                              <View style={styles.rowInfo}>
                                <Text style={styles.rowInfoLabel}>Cliente:</Text>
                                <Text style={styles.rowInfoValue}>{customer.nombre}</Text>
                              </View>
                              <View style={styles.rowInfo}>
                                <Text style={styles.rowInfoLabel}>Dirección:</Text>
                                <Text style={styles.rowInfoValue}>{customer.direccion}</Text>
                              </View>
                              <View style={styles.rowInfo}>
                                <Text style={styles.rowInfoLabel}>Zona / Sucursal:</Text>
                                <Text style={styles.rowInfoValue}>
                                  {customer.zona} · {customer.branchId === 'branch-gd1' ? 'GD 1' : 'GD 2'}
                                </Text>
                              </View>
                              {customer.telefono ? (
                                <View style={[styles.rowInfo, { marginVertical: Spacing.sm }]}>
                                  <Text style={styles.rowInfoLabel}>Contacto:</Text>
                                  <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                                    <TouchableOpacity
                                      style={{ backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.sm }}
                                      onPress={() => handleCall(customer.telefono)}
                                    >
                                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>📞 Llamar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={{ backgroundColor: '#25D366', paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.sm }}
                                      onPress={() => handleWhatsApp(customer.telefono)}
                                    >
                                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 13 }}>💬 WhatsApp</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              ) : null}
                              <View style={[styles.rowInfo, { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.sm, paddingTop: Spacing.sm }]}>
                                <Text style={styles.rowInfoLabel}>Método de Pago:</Text>
                                <Text style={[styles.rowInfoValue, { fontWeight: 'bold' }]}>
                                  {(order.paymentMethod || 'Efectivo').toUpperCase()}
                                </Text>
                              </View>
                              <View style={styles.rowInfo}>
                                <Text style={styles.rowInfoLabel}>Monto total:</Text>
                                <Text style={[styles.rowInfoValue, { fontWeight: 'bold', fontSize: FontSize.lg, color: Colors.primary }]}>
                                  ${order.total.toLocaleString('es-AR')}
                                </Text>
                              </View>
                              {order.abonaCon && (
                                <View style={{ backgroundColor: '#f8fafc', padding: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.sm }}>
                                  <Text style={{ fontSize: FontSize.sm, color: Colors.textSecondary }}>Abona con: ${order.abonaCon.toLocaleString('es-AR')}</Text>
                                  <Text style={{ fontSize: FontSize.md, fontWeight: 'bold', color: Colors.success }}>Vuelto sugerido: ${(order.cambioEstimado || 0).toLocaleString('es-AR')}</Text>
                                </View>
                              )}
                            </View>

                            {/* Acciones */}
                            <View style={{ flexDirection: 'column', gap: 10, marginTop: Spacing.xl }}>
                              {order.estado !== 'en_camino' ? (
                                <TouchableOpacity
                                  style={{ height: 56, backgroundColor: Colors.primary, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' }}
                                  onPress={() => handleStartDelivery(order.id)}
                                >
                                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>🚚 Marcar en camino</Text>
                                </TouchableOpacity>
                              ) : (
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                  <TouchableOpacity
                                    style={{ flex: 1.2, height: 56, backgroundColor: Colors.success, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' }}
                                    onPress={() => handleMarkAsDelivered(order.id)}
                                  >
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>✔ Marcar entregado</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={{ flex: 1, height: 56, backgroundColor: Colors.danger, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center' }}
                                    onPress={() => handleStopFailure(order.id)}
                                  >
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>❌ No entregado</Text>
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <Text style={styles.sectionTitleList}>Todos los Pedidos Activos ({availableOrders.length})</Text>

                {availableOrders.length === 0 ? (
                  <View style={styles.noActiveDelivery}>
                    <Text style={styles.noDeliveryIcon}>📦</Text>
                    <Text style={styles.noDeliveryTitle}>No hay pedidos activos</Text>
                    <Text style={styles.noDeliverySubtitle}>
                      Actualmente no hay pedidos pendientes de entregar en el sistema.
                    </Text>
                  </View>
                ) : (
                  availableOrders.map((order) => {
                    const client = mockClients.find((c) => c.id === order.clienteId);
                    const customer = client || currentCustomer;
                    return (
                      <View key={order.id} style={styles.orderDelivererCard}>
                        <View style={styles.orderDelivererHeader}>
                          <Text style={styles.orderDelivererNum}>Pedido #{order.numero}</Text>
                          {order.repartidorId ? (
                            order.repartidorId === repartidorData?.id ? (
                              <View style={[styles.statusBadge, { backgroundColor: '#dcfce7' }]}>
                                <Text style={[styles.statusBadgeText, { color: '#16a34a' }]}>Asignado a Mí</Text>
                              </View>
                            ) : (
                              <View style={[styles.statusBadge, { backgroundColor: '#fee2e2' }]}>
                                <Text style={[styles.statusBadgeText, { color: '#ef4444' }]}>Tomado</Text>
                              </View>
                            )
                          ) : (
                            <View style={[styles.statusBadge, { backgroundColor: '#dbeafe' }]}>
                              <Text style={[styles.statusBadgeText, { color: '#2563eb' }]}>Disponible</Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.orderDelivererBody}>
                          <View style={styles.rowInfo}>
                            <Text style={styles.rowInfoLabel}>Cliente:</Text>
                            <Text style={styles.rowInfoValue}>{order.customerName || customer.nombre}</Text>
                          </View>
                          <View style={styles.rowInfo}>
                            <Text style={styles.rowInfoLabel}>Dirección:</Text>
                            <Text style={styles.rowInfoValue}>{order.originalAddress || customer.direccion}</Text>
                          </View>
                          <View style={styles.rowInfo}>
                            <Text style={styles.rowInfoLabel}>Zona:</Text>
                            <Text style={styles.rowInfoValue}>{order.deliveryZone || customer.zona}</Text>
                          </View>
                          {order.addressReference ? (
                            <View style={styles.rowInfo}>
                              <Text style={styles.rowInfoLabel}>Referencia:</Text>
                              <Text style={[styles.rowInfoValue, { fontStyle: 'italic', color: '#0ea5e9' }]}>
                                {order.addressReference}
                              </Text>
                            </View>
                          ) : null}
                          <View style={styles.rowInfo}>
                            <Text style={styles.rowInfoLabel}>Monto total:</Text>
                            <Text style={[styles.rowInfoValue, { fontWeight: 'bold', color: Colors.primary }]}>
                              ${order.total.toLocaleString('es-AR')}
                            </Text>
                          </View>
                          {order.repartidorId && (
                            <View style={{ marginTop: Spacing.sm, padding: Spacing.sm, backgroundColor: '#f8fafc', borderRadius: Radius.sm }}>
                              <Text style={{ fontSize: 13, color: '#475569', fontWeight: '500' }}>
                                {order.repartidorId === repartidorData?.id
                                  ? '✔ Está en tu hoja de ruta'
                                  : `🚚 Asignado a: ${repartidores.find(r => r.id === order.repartidorId)?.nombre || 'Otro repartidor'}`}
                              </Text>
                            </View>
                          )}
                        </View>

                        {!order.repartidorId && (
                          <TouchableOpacity
                            style={{ height: 50, backgroundColor: Colors.success, borderRadius: Radius.md, justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md }}
                            onPress={() => handleTakeOrder(order.id)}
                          >
                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 15 }}>🚚 Tomar Pedido para mi Reparto</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })
                )}
              </>
            )}
          </View>
        )}

        <View style={{ height: Spacing.huge }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  roleSelectorHeader: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: Spacing.md,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.md,
    padding: 4,
    gap: 4,
  },
  roleTab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  roleTabActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  roleTabText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  roleTabTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.huge,
  },
  section: {
    padding: Spacing.xl,
  },
  sectionHeader: {
    marginBottom: Spacing.lg,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activeBadgeText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  sectionTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Paradas
  stopsContainer: {
    marginTop: Spacing.xl,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  stopsTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  stop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  stopIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stopIconCompleted: {
    backgroundColor: Colors.success,
  },
  stopIconCurrent: {
    backgroundColor: Colors.primary,
  },
  stopIconPending: {
    backgroundColor: Colors.border,
  },
  stopIconText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  stopInfo: {
    flex: 1,
    gap: 2,
  },
  stopName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  stopNameCurrent: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  stopAddress: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // Sin reparto activo
  noActiveDelivery: {
    alignItems: 'center',
    padding: Spacing.huge,
    backgroundColor: Colors.white,
    margin: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noDeliveryIcon: {
    fontSize: 56,
    marginBottom: Spacing.lg,
  },
  noDeliveryTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  noDeliverySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Historial
  historySection: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  historyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  emptyHistoryCard: {
    backgroundColor: Colors.white,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  emptyHistoryText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  historyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  historyNumero: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  historyFecha: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  historyDeliverer: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  historyDelivererLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  historyDelivererName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  historyStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyStatusText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.success,
  },

  // ==========================================
  // ESTILOS VISTA REPARTIDOR
  // ==========================================
  repartidorSection: {
    padding: Spacing.xl,
  },
  repartidorMetaCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  repartidorMetaTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  repartidorMetaSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  repartidorZoneTag: {
    backgroundColor: Colors.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  repartidorZoneTagText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  sectionTitleList: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  orderDelivererCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  orderDelivererHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
  },
  orderDelivererNum: {
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
  orderDelivererBody: {
    gap: Spacing.sm,
  },
  rowInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowInfoLabel: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    flex: 1,
  },
  rowInfoValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flex: 2,
    textAlign: 'right',
  },
  orderDelivererActions: {
    marginTop: Spacing.lg,
  },
  actionBtn: {
    marginTop: 0,
  },
  guestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    backgroundColor: Colors.background,
  },
  guestIcon: {
    fontSize: 72,
    marginBottom: Spacing.xl,
  },
  guestTitle: {
    fontSize: 26,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  guestText: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xxl,
  },
  guestButton: {
    width: '100%',
    height: 60,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: FontWeight.bold,
  },
});
