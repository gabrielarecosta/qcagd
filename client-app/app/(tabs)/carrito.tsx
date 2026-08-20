import React, { useState, useCallback, useMemo, useEffect } from 'react';

import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing, TouchTarget } from '../../constants/Spacing';
import { useCartStore } from '../../store/cartStore';
import { useOrderStore } from '../../store/orderStore';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { CartItem, CATEGORY_ICONS, Order, CustomerAddress } from '../../types';
import { formatPrice as fmtPrice } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import MaterialCommunityIcons from '../../components/icons/MaterialCommunityIcons';import { customAlert } from '../../utils/alert';
import { offerService } from '@shared/services/offerService';
import { deliverySlotService } from '@shared/services/deliverySlotService';
import { companySettingsService } from '@shared/services/companySettingsService';
import { clientService } from '@shared/services/clientService';
import { orderService } from '@shared/services/orderService';
import { paymentService } from '@shared/services/paymentService';
import { PaymentMethodConfig } from '@shared/types/payment';
import { getArgentinaDate, getArgentinaTime, getArgentinaDayLabel } from '@shared/utils/dateUtils';
import { supabase } from '@shared/services/supabaseClient';
import { buildWhatsAppOrderMessage } from '@shared/utils/whatsappOrderMessage';



// ──────────────────────────────────────────────────────────────
// Tipo: método de entrega
// ──────────────────────────────────────────────────────────────
type DeliveryMethod = 'reparto' | 'retiro' | 'whatsapp';
type PaymentOption = 'efectivo' | 'mercadopago' | 'transferencia' | 'pago_a_acordar' | 'cuenta_corriente';

// Los datos bancarios se cargan dinámicamente desde company_settings en la BD

const DELIVERY_OPTIONS: {
  key: DeliveryMethod;
  icon: string;
  label: string;
  sub: string;
}[] = [
    {
      key: 'reparto',
      icon: '🚚',
      label: 'Envío por reparto',
      sub: 'Lo llevamos a tu domicilio',
    },
    {
      key: 'retiro',
      icon: '🏪',
      label: 'Retiro en local',
      sub: 'Pasás a buscar cuando quieras',
    },
    {
      key: 'whatsapp',
      icon: '💬',
      label: 'Coordinar por WhatsApp',
      sub: 'Te contactamos para coordinar',
    },
  ];

import { useWindowDimensions } from 'react-native';
import { DesktopStartScreen } from '../../components/screens/DesktopStartScreen';
import { MobileStartScreen } from '../../components/screens/MobileStartScreen';

// El número de WhatsApp y otros datos se cargan dinámicamente desde company_settings en la BD

// ──────────────────────────────────────────────────────────────
// Pantalla principal del carrito
// ──────────────────────────────────────────────────────────────
export default function CarritoScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const { items, updateQuantity, removeProduct, clearCart, repeatOrder, totalItems, totalPrice, fetchPromotions } =
    useCartStore();
  const { addOrder, orders } = useOrderStore();
  const { clientData, isLoggedIn } = useAuthStore();


  useEffect(() => {
    fetchPromotions();
    const loadSettings = async () => {
      const settings = await companySettingsService.get();
      setCompanySettings(settings);
      try {
        const { data } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'global_order_min_amount')
          .maybeSingle();
        if (data?.value && typeof data.value === 'object' && 'amount' in data.value) {
          setMinOrderAmount(Number((data.value as any).amount) || 0);
        }
      } catch {
        // si falla, no bloqueamos el flujo
      }
    };
    loadSettings();
  }, []);

  const [paymentConfigs, setPaymentConfigs] = useState<PaymentMethodConfig[]>([]);

  useEffect(() => {
    const loadPaymentConfigs = async () => {
      try {
        const configs = await paymentService.getConfigs();
        setPaymentConfigs(configs);
      } catch (err) {
        console.warn('Error al cargar medios de pago:', err);
      }
    };
    loadPaymentConfigs();
  }, []);

  const lastDeliveredOrder = useMemo(() => {
    return orders.filter(o => o.estado === 'entregado')[0];
  }, [orders]);

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('reparto');
  const [paymentMethod, setPaymentMethod] = useState<PaymentOption>('efectivo');
  const [outOfStockPreference, setOutOfStockPreference] = useState<'llamar' | 'reemplazar'>('llamar');
  const [efectivoAbonaCon, setEfectivoAbonaCon] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [companySettings, setCompanySettings] = useState<any>(null);

  // Helper para saber si un método de pago está habilitado para el tipo de cliente actual
  const isMethodAllowed = useCallback((methodId: string) => {
    if (!paymentConfigs || paymentConfigs.length === 0) return true;
    const cfg = paymentConfigs.find(c => c.id === methodId);
    if (!cfg || !cfg.activo) return false;

    const currentType = clientData?.tipoCliente || 'minorista';
    if (currentType === 'sucursal') return cfg.disponibleSucursal;
    if (currentType === 'mayorista') return cfg.disponibleMayorista;
    return cfg.disponibleMinorista; // minorista / consumidor_final
  }, [paymentConfigs, clientData?.tipoCliente]);

  // Si el método actual fue deshabilitado, cambiar automáticamente al primer método disponible
  useEffect(() => {
    if (paymentConfigs.length > 0) {
      if (!isMethodAllowed(paymentMethod)) {
        const priorityOrder: PaymentOption[] = ['efectivo', 'mercadopago', 'transferencia', 'pago_a_acordar', 'cuenta_corriente'];
        const firstAvailable = priorityOrder.find(m => isMethodAllowed(m));
        if (firstAvailable) {
          setPaymentMethod(firstAvailable);
        }
      }
    }
  }, [paymentConfigs, clientData?.tipoCliente, isMethodAllowed, paymentMethod]);

  // Estados de franjas horarias (Etapa 7)
  const [deliveryDate, setDeliveryDate] = useState<string>(''); // YYYY-MM-DD
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [slotCapacities, setSlotCapacities] = useState<Record<string, number>>({});
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Estados de direcciones de entrega múltiples
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<CustomerAddress | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [minOrderAmount, setMinOrderAmount] = useState(0);

  useEffect(() => {
    const fetchAddresses = async () => {
      if (clientData) {
        try {
          const list = await clientService.getAddresses(clientData.id);
          setAddresses(list);
          const def = list.find(a => a.defaultAddress);
          if (def) {
            setSelectedAddress(def);
          } else if (list.length > 0) {
            setSelectedAddress(list[0]);
          }
        } catch (e) {
          console.warn('Error fetching addresses in cart:', e);
        }
      }
    };
    fetchAddresses();
  }, [clientData]);

  // Opciones de fechas para los próximos 7 días en el huso America/Argentina/Buenos_Aires
  const dateOptions = useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = getArgentinaDate(d);

      let label = '';
      if (i === 0) {
        label = `Hoy`;
      } else if (i === 1) {
        label = `Mañana`;
      } else {
        label = getArgentinaDayLabel(d);
      }

      list.push({ dateStr, label, rawDate: d });
    }
    return list;
  }, []);

  const isSlotDisabled = useCallback((slot: any, capacities: Record<string, number>) => {
    if (!slot.activo) return true;

    // Validar si es del día de hoy y ya pasó
    const todayStr = getArgentinaDate();
    if (deliveryDate === todayStr) {
      const nowTimeStr = getArgentinaTime();
      if (nowTimeStr >= slot.hora_inicio) {
        return true;
      }
    }

    // Validar si superó el cupo máximo
    if (slot.max_pedidos !== null && slot.max_pedidos !== undefined) {
      const count = capacities[slot.id] || 0;
      if (count >= slot.max_pedidos) {
        return true;
      }
    }

    return false;
  }, [deliveryDate]);

  // Cargar franjas al montar
  useEffect(() => {
    const loadSlots = async () => {
      try {
        let allSlots = await deliverySlotService.getAll();
        if (!allSlots || allSlots.length === 0) {
          allSlots = [
            { id: 'slot-morning', nombre: 'Mañana', hora_inicio: '08:00', hora_fin: '12:00', max_pedidos: 15, activo: true },
            { id: 'slot-midday', nombre: 'Mediodía', hora_inicio: '12:00', hora_fin: '14:00', max_pedidos: 15, activo: true },
            { id: 'slot-siesta', nombre: 'Siesta', hora_inicio: '14:00', hora_fin: '16:00', max_pedidos: 15, activo: true },
            { id: 'slot-afternoon', nombre: 'Tarde', hora_inicio: '16:00', hora_fin: '19:30', max_pedidos: 15, activo: true },
            { id: 'slot-night', nombre: 'Tarde Noche', hora_inicio: '19:30', hora_fin: '22:00', max_pedidos: 15, activo: true }
          ];
        }
        const activeSlots = allSlots.filter((s: any) => s.activo);
        setSlots(activeSlots);
        if (activeSlots.length > 0 && !deliveryDate) {
          setDeliveryDate(getArgentinaDate());
        }

      } catch (err) {
        console.error('Error loading slots, using fallback:', err);
        const fallback = [
          { id: 'slot-morning', nombre: 'Mañana', hora_inicio: '08:00', hora_fin: '12:00', max_pedidos: 15, activo: true },
          { id: 'slot-midday', nombre: 'Mediodía', hora_inicio: '12:00', hora_fin: '14:00', max_pedidos: 15, activo: true },
          { id: 'slot-siesta', nombre: 'Siesta', hora_inicio: '14:00', hora_fin: '16:00', max_pedidos: 15, activo: true },
          { id: 'slot-afternoon', nombre: 'Tarde', hora_inicio: '16:00', hora_fin: '19:30', max_pedidos: 15, activo: true },
          { id: 'slot-night', nombre: 'Tarde Noche', hora_inicio: '19:30', hora_fin: '22:00', max_pedidos: 15, activo: true }
        ];
        setSlots(fallback);
        if (!deliveryDate) {
          setDeliveryDate(getArgentinaDate());
        }
      }
    };
    loadSlots();
  }, []);

  // Recalcular capacidades cuando cambia la fecha o franjas
  useEffect(() => {
    if (!deliveryDate || slots.length === 0) return;

    const fetchCapacities = async () => {
      setIsLoadingSlots(true);
      const capacities: Record<string, number> = {};
      try {
        await Promise.all(
          slots.map(async (slot) => {
            const count = await deliverySlotService.getSlotOrderCount(slot.id, deliveryDate);
            capacities[slot.id] = count;
          })
        );
        setSlotCapacities(capacities);

        // Auto-seleccionar primer slot habilitado si el seleccionado ya no es válido
        const currentSlotIsValid = selectedSlot &&
          slots.some(s => s.id === selectedSlot.id) &&
          !isSlotDisabled(selectedSlot, capacities);

        if (!currentSlotIsValid) {
          const firstAvailable = slots.find(s => !isSlotDisabled(s, capacities));
          setSelectedSlot(firstAvailable || null);
        }
      } catch (err) {
        console.error('Error loading capacities:', err);
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchCapacities();
  }, [deliveryDate, slots, isSlotDisabled]);

  const clientOrders = useMemo(() => {
    if (!clientData) return [];
    return orders.filter(o => o.clienteId === clientData.id);
  }, [orders, clientData]);

  const handleRepeatOrder = useCallback((order: Order) => {
    repeatOrder(order);
    customAlert('Pedido cargado', `Los productos del pedido ${order.numero} fueron cargados al carrito.`);
  }, [repeatOrder]);

  const total = totalPrice();
  const count = totalItems();

  // ── Confirmar pedido ──
  const handleConfirmOrder = useCallback(() => {
    const selectedOption = DELIVERY_OPTIONS.find((o) => o.key === deliveryMethod)!;

    // Validar franja horaria requerida para despacho/reparto
    if (deliveryMethod !== 'retiro' && !selectedSlot) {
      customAlert('Horario requerido', 'Por favor, seleccioná una fecha y franja horaria de entrega válidas.');
      return;
    }

    const orderNum = `PED-${Date.now().toString().slice(-6)}`;
    const paymentLabel = paymentMethod === 'efectivo'
      ? 'Efectivo / Contra entrega'
      : paymentMethod === 'mercadopago'
        ? 'Mercado Pago'
        : paymentMethod === 'transferencia'
          ? 'Transferencia Bancaria'
          : paymentMethod === 'pago_a_acordar'
            ? 'Pago a acordar'
            : 'Cuenta Corriente';

    let message =
      `Pedido: ${count} artículo${count !== 1 ? 's' : ''}\n` +
      `Total: ${fmtPrice(total)}\n` +
      `Entrega: ${selectedOption.label}\n` +
      `Pago: ${paymentLabel}\n`;

    if (deliveryMethod !== 'retiro' && selectedSlot) {
      message += `Fecha de Entrega: ${deliveryDate}\n` +
        `Horario: ${selectedSlot.nombre} (${selectedSlot.hora_inicio} a ${selectedSlot.hora_fin} hs)\n`;
    }

    if (observaciones) {
      message += `Observaciones: ${observaciones}\n`;
    }

    message += `Ante falta de stock: ${outOfStockPreference === 'llamar' ? 'Llamarme para consultar' : 'Elegir artículo similar'}`;

    customAlert('Confirmar pedido', message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        style: 'default',
        onPress: async () => {
          if (deliveryMethod === 'whatsapp') {
            // Si eligió WhatsApp: genera el mensaje automático estructurado con número de pedido y detalle
            const waMessage = buildWhatsAppOrderMessage({
              orderNum: orderNum,
              customerName: clientData?.nombre || 'Cliente',
              customerPhone: clientData?.telefono || '',
              items: items.map((i) => {
                const calc = offerService.calculateFinalPrice(i.producto, i.cantidad, customerType, promotions);
                return {
                  name: i.producto.nombre,
                  presentation: i.producto.presentacion,
                  qty: i.cantidad,
                  unitPrice: calc.priceFinal,
                  subtotal: calc.subtotal,
                };
              }),
              total: total,
              deliveryMethod: deliveryMethod,
              deliveryDate: deliveryDate || undefined,
              deliveryTimeSlot: selectedSlot ? `${selectedSlot.hora_inicio} a ${selectedSlot.hora_fin} hs` : undefined,
              address: selectedAddress ? selectedAddress.direccion : clientData?.direccion,
              outOfStockPreference: outOfStockPreference,
              observaciones: observaciones,
              paymentMethod: paymentMethod,
              isTransferReceipt: false,
            });

            const targetNumber = companySettings?.whatsapp || '5493511234567';
            const cleanPhone = targetNumber.replace(/[^0-9]/g, '');
            Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`);
          }

          // Crear objeto Order real e insertarlo en el store con precios de oferta recalculados
          const customerType = clientData?.tipoCliente || 'minorista';
          const promotions = useCartStore.getState().promotions;

          const newOrder: Order = {
            id: `ord-${Date.now()}`,
            numero: orderNum,
            clienteId: clientData?.id || 'cli-1',
            branchId: clientData?.branchId || 'branch-gd1',
            fecha: new Date().toISOString(),
            customerName: clientData?.nombre || 'Cliente sin nombre',
            customerPhone: clientData?.telefono || '',
            items: items.map((i) => {
              const calc = offerService.calculateFinalPrice(i.producto, i.cantidad, customerType, promotions);
              return {
                producto: i.producto,
                cantidad: i.cantidad,
                precioUnitario: calc.priceFinal,
                subtotal: calc.subtotal,
              };
            }),
            total: total,
            estado: deliveryMethod === 'whatsapp' ? 'pendiente' : 'en_preparacion',
            observaciones: observaciones || undefined,
            outOfStockPreference: outOfStockPreference,
            repartidorId: undefined,

            // Campos de entrega estructurados
            deliveryDate: deliveryMethod !== 'retiro' ? deliveryDate : undefined,
            deliveryStartTime: deliveryMethod !== 'retiro' ? selectedSlot?.hora_inicio : undefined,
            deliveryEndTime: deliveryMethod !== 'retiro' ? selectedSlot?.hora_fin : undefined,
            deliveryTimeSlotId: deliveryMethod !== 'retiro' ? selectedSlot?.id : undefined,
            deliveryMethod: deliveryMethod,

            // Geolocalización y dirección múltiple seleccionada
            originalAddress: deliveryMethod === 'reparto' ? (selectedAddress ? selectedAddress.direccion : clientData?.direccion) : undefined,
            formattedAddress: deliveryMethod === 'reparto' ? (selectedAddress ? selectedAddress.direccion : clientData?.direccion) : undefined,
            latitude: deliveryMethod === 'reparto' ? (selectedAddress?.latitude || clientData?.latitude || undefined) : undefined,
            longitude: deliveryMethod === 'reparto' ? (selectedAddress?.longitude || clientData?.longitude || undefined) : undefined,

            addressReference: deliveryMethod === 'reparto' ? (selectedAddress?.indicaciones || undefined) : undefined,
            locationVerified: deliveryMethod === 'reparto' ? (selectedAddress?.locationVerified || false) : false,
            deliveryZone: deliveryMethod === 'reparto' ? (selectedAddress?.zona || clientData?.zona || 'Centro') : undefined,

            // Campos de pago
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'cuenta_corriente' ? 'cuenta_corriente' : 'pendiente',
            abonaCon: paymentMethod === 'efectivo' && efectivoAbonaCon ? Number(efectivoAbonaCon) : undefined,
            cambioEstimado: paymentMethod === 'efectivo' && efectivoAbonaCon && Number(efectivoAbonaCon) > total ? Number(efectivoAbonaCon) - total : undefined,
          };

          setIsConfirming(true);
          let createdOrder: any = null;
          try {
            // 1. Validaciones previas
            if (!items || items.length === 0) {
              throw new Error('El carrito está vacío.');
            }

            // 2. Si eligió Mercado Pago, validar/generar la preferencia primero
            let mpTargetUrl: string | null = null;
            if (paymentMethod === 'mercadopago') {
              try {
                const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3001';
                const mpRes = await fetch(`${backendUrl}/api/mercadopago/create-preference`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    orderId: newOrder.id,
                    items: items.map((i) => {
                      const calc = offerService.calculateFinalPrice(i.producto, i.cantidad, customerType, promotions);
                      return {
                        title: i.producto.nombre,
                        unit_price: calc.priceFinal,
                        quantity: i.cantidad,
                      };
                    }),
                    payer: {
                      name: clientData?.nombre || 'Cliente',
                      email: clientData?.email || '',
                    },
                  }),
                });

                if (mpRes.ok) {
                  const mpData = await mpRes.json();
                  mpTargetUrl = mpData.init_point || mpData.sandbox_init_point || null;
                } else {
                  throw new Error('No se pudo generar la preferencia de pago en Mercado Pago.');
                }
              } catch (mpErr: any) {
                console.error('Error iniciando checkout de Mercado Pago:', mpErr);
                throw new Error('No se pudo conectar con Mercado Pago. Por favor, intentá nuevamente o elegí otro medio de pago.');
              }
            }

            // 3. Crear el pedido en la base de datos
            await addOrder(newOrder, clientData?.email || '');
            createdOrder = newOrder;

            // 4. Parámetros para la pantalla de confirmación con items estructurados
            const confirmParams = {
              orderId: newOrder.id,
              orderNum: newOrder.numero,
              orderTotal: String(total),
              deliveryMethod: deliveryMethod,
              paymentMethod: paymentMethod,
              deliveryDate: deliveryDate || '',
              slotNombre: selectedSlot?.nombre || '',
              slotHoraInicio: selectedSlot?.hora_inicio || '',
              slotHoraFin: selectedSlot?.hora_fin || '',
              outOfStockPreference: outOfStockPreference,
              observaciones: observaciones || '',
              itemsJson: JSON.stringify(
                newOrder.items.map((it) => ({
                  name: it.producto.nombre,
                  presentation: it.producto.presentacion,
                  qty: it.cantidad,
                  unitPrice: it.precioUnitario,
                  subtotal: it.subtotal,
                }))
              ),
            };

            // 5. Limpiar carrito y resetear solo tras éxito total comprobado
            clearCart();
            resetCheckoutState();

            // 6. Redirección
            if (paymentMethod === 'mercadopago' && mpTargetUrl) {
              if (Platform.OS === 'web') {
                window.location.href = mpTargetUrl;
              } else {
                Linking.openURL(mpTargetUrl);
              }
              return;
            }

            router.push({
              pathname: '/pedido-confirmado' as any,
              params: confirmParams,
            });

          } catch (err: any) {
            console.error('Error confirming order:', err);
            // Si el pedido se llegó a guardar en BD pero falló un paso posterior, hacer rollback
            if (createdOrder) {
              try {
                await orderService.delete(createdOrder.id, clientData?.email || 'client');
              } catch (delErr) {
                console.warn('Rollback failed:', delErr);
              }
            }
            customAlert(
              'No se pudo generar el pedido',
              err?.message || 'Ocurrió un error al procesar tu pedido. Tus productos se mantienen en el carrito para que puedas volver a intentar.'
            );
          } finally {
            setIsConfirming(false);
          }
        },
      },
    ]);
  }, [count, total, deliveryMethod, paymentMethod, efectivoAbonaCon, observaciones, items, clearCart, addOrder, deliveryDate, selectedSlot, clientData, selectedAddress]);


  const resetCheckoutState = () => {
    setDeliveryMethod('reparto');
    setPaymentMethod('efectivo');
    setEfectivoAbonaCon('');
    setObservaciones('');
    setDeliveryDate(getArgentinaDate());
    setSelectedSlot(null);
    const def = addresses.find(a => a.defaultAddress);
    if (def) {
      setSelectedAddress(def);
    } else if (addresses.length > 0) {
      setSelectedAddress(addresses[0]);
    } else {
      setSelectedAddress(null);
    }
  };

  const handleRepeatLastOrder = useCallback(() => {
    if (lastDeliveredOrder) {
      repeatOrder(lastDeliveredOrder);
    }
  }, [repeatOrder]);

  if (!isLoggedIn) {
    return isDesktop ? <DesktopStartScreen /> : <MobileStartScreen />;
  }



  // ──────────────────────────────────────────────────────────────
  // ESTADO: CREANDO / PROCESANDO PEDIDO (LOADER)
  // ──────────────────────────────────────────────────────────────
  if (isConfirming) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingOrderContainer}>
          <View style={styles.loadingOrderCard}>
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: Spacing.lg }} />
            <Text style={styles.loadingOrderTitle}>
              {paymentMethod === 'mercadopago' ? 'Conectando con Mercado Pago...' : 'Creando tu pedido...'}
            </Text>
            <Text style={styles.loadingOrderSub}>
              Por favor esperá unos segundos mientras confirmamos tu compra y preparamos los detalles de entrega.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // ESTADO: CARRITO VACÍO
  // ──────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mis Pedidos</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>Tu pedido está vacío</Text>
            <Text style={styles.emptySubtitle}>Agregá productos desde el catálogo</Text>

            <View style={styles.emptyActions}>
              <Button
                title="📦  Ir al catálogo"
                onPress={() => router.push('/(tabs)/catalogo')}
              />
            </View>
          </View>

          {/* Historial de Pedidos del Pasado */}
          <View style={[styles.section, { marginTop: Spacing.xl, paddingHorizontal: Spacing.xl }]}>
            <Text style={[styles.sectionTitle, { fontSize: 18, marginBottom: Spacing.md }]}>Historial de pedidos ({clientOrders.length})</Text>
            {clientOrders.length === 0 ? (
              <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginVertical: 20 }}>No tenés pedidos registrados todavía.</Text>
            ) : (
              clientOrders.map((o) => (
                <View key={o.id} style={styles.orderHistoryCard}>
                  <View style={styles.orderHistoryHeader}>
                    <Text style={styles.orderHistoryNumber}>Pedido #{o.numero}</Text>
                    <Text style={[styles.orderHistoryStatus, { color: Colors.primary }]}>{o.estado.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.orderHistoryDate}>
                    Fecha: {new Date(o.fecha).toLocaleDateString()}
                  </Text>
                  {o.deliveryDate && (
                    <Text style={styles.orderHistoryDelivery}>
                      Entrega: {o.deliveryDate} ({o.deliveryStartTime} a {o.deliveryEndTime} hs)
                    </Text>
                  )}
                  <Text style={styles.orderHistoryTotal}>
                    Monto total: {fmtPrice(o.total)}
                  </Text>
                  <TouchableOpacity style={styles.orderHistoryRepeatBtn} onPress={() => handleRepeatOrder(o)} activeOpacity={0.8}>
                    <Text style={styles.orderHistoryRepeatBtnText}>🔄 Volver a comprar</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // ESTADO: CARRITO CON PRODUCTOS
  // ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Mis Pedidos</Text>
            <Text style={styles.headerSubtitle}>{count} artículo{count !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            onPress={() =>
              customAlert('Vaciar carrito', '¿Querés eliminar todos los productos?', [
                { text: 'No', style: 'cancel' },
                { text: 'Sí, vaciar', style: 'destructive', onPress: () => clearCart() },
              ])
            }
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>🗑 Vaciar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ── Lista de ítems ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Productos</Text>
            {items.map((item) => (
              <CartItemRow
                key={item.producto.id}
                item={item}
                onIncrease={() => updateQuantity(item.producto.id, item.cantidad + 1)}
                onDecrease={() => updateQuantity(item.producto.id, item.cantidad - 1)}
                onRemove={() => removeProduct(item.producto.id)}
              />
            ))}
          </View>

          {/* ── Barra de mínimo de compra ── */}
          {minOrderAmount > 0 && deliveryMethod !== 'retiro' && deliveryMethod !== 'whatsapp' && (
            <View style={styles.minOrderBar}>
              <View style={styles.minOrderBarHeader}>
                <Text style={[styles.minOrderBarText, total >= minOrderAmount && { color: '#16a34a' }]}>
                  {total >= minOrderAmount
                    ? '🎉 ¡Pedido mínimo alcanzado! Envío gratis.'
                    : `🚚 Faltan ${fmtPrice(Math.max(minOrderAmount - total, 0))} para el pedido mínimo`}
                </Text>
                <Text style={[styles.minOrderBarSubtext, total >= minOrderAmount && { color: '#16a34a' }]}>
                  {fmtPrice(total)} / {fmtPrice(minOrderAmount)}
                </Text>
              </View>
              <View style={styles.minOrderBarTrack}>
                <View
                  style={[
                    styles.minOrderBarFill,
                    { flex: Math.min(total / minOrderAmount, 1) },
                    total >= minOrderAmount && { backgroundColor: '#16a34a' },
                  ]}
                />
                <View style={{ flex: Math.max(1 - total / minOrderAmount, 0) }} />
              </View>
            </View>
          )}
          <View style={styles.section}>

            <Text style={styles.sectionTitle}>¿Cómo querés recibirlo?</Text>
            <View style={styles.deliveryOptions}>
              {DELIVERY_OPTIONS.map((opt) => {
                const selected = deliveryMethod === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.deliveryOption,
                      selected && styles.deliveryOptionSelected,
                    ]}
                    onPress={() => setDeliveryMethod(opt.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.deliveryOptionIcon}>{opt.icon}</Text>
                    <View style={styles.deliveryOptionText}>
                      <Text
                        style={[
                          styles.deliveryOptionLabel,
                          selected && styles.deliveryOptionLabelSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.deliveryOptionSub}>{opt.sub}</Text>
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        selected && styles.radioCircleSelected,
                      ]}
                    >
                      {selected && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Dirección de entrega (Multiple addresses selector) ── */}
          {deliveryMethod === 'reparto' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Dirección de entrega</Text>

              {addresses.length === 0 ? (
                <View style={{ padding: Spacing.md, borderRadius: Radius.md, backgroundColor: '#f1f5f9' }}>
                  <Text style={{ fontSize: FontSize.md, fontWeight: 'bold', color: Colors.textPrimary }}>
                    🏠 Dirección principal de tu perfil:
                  </Text>
                  <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 4 }}>
                    {clientData?.direccion} (Zona {clientData?.zona || 'Centro'})
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 4 }}>
                    Podés cargar direcciones adicionales desde tu pestaña de Cuenta.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: Spacing.sm }}>
                  <Text style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: 2 }}>
                    Seleccioná la dirección donde querés recibir el pedido:
                  </Text>
                  {addresses.map((addr) => {
                    const isSelected = selectedAddress?.id === addr.id;
                    return (
                      <TouchableOpacity
                        key={addr.id}
                        style={{
                          padding: Spacing.md,
                          borderRadius: Radius.md,
                          borderWidth: 1.5,
                          borderColor: isSelected ? Colors.primary : Colors.border,
                          backgroundColor: isSelected ? Colors.primary + '05' : 'white',
                          gap: 4
                        }}
                        onPress={() => setSelectedAddress(addr)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: isSelected ? Colors.primary : Colors.textPrimary }}>
                            {addr.defaultAddress ? '🏠 Dirección Principal' : '📍 Dirección Auxiliar'}
                          </Text>
                          {isSelected && (
                            <MaterialCommunityIcons name="check-circle" size={18} color={Colors.primary} />
                          )}
                        </View>
                        <Text style={{ fontSize: 13, color: Colors.textPrimary }}>{addr.direccion}</Text>
                        <Text style={{ fontSize: 11, color: Colors.textSecondary }}>Zona {addr.zona}</Text>
                        {addr.indicaciones ? (
                          <Text style={{ fontSize: 11, color: '#0ea5e9', fontStyle: 'italic', marginTop: 2 }}>
                            ℹ️ Referencia: {addr.indicaciones}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Botón para ir a gestionar direcciones en cuenta */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md }}
                onPress={() => router.push('/(tabs)/cuenta')}
              >
                <Text style={{ fontSize: 13, color: Colors.primary, fontWeight: 'bold' }}>
                  ⚙️ Gestionar o Agregar Direcciones
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Horario de entrega (Etapa 7) ── */}
          {deliveryMethod !== 'retiro' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Horario de entrega</Text>

              <Text style={styles.inputLabel}>Fecha de entrega</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dateSelectorRow}
                style={{ marginBottom: Spacing.md }}
              >
                {dateOptions.map((opt) => {
                  const isSelected = deliveryDate === opt.dateStr;
                  return (
                    <TouchableOpacity
                      key={opt.dateStr}
                      style={[
                        styles.dateBadge,
                        isSelected && styles.dateBadgeSelected
                      ]}
                      onPress={() => setDeliveryDate(opt.dateStr)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.dateBadgeText, isSelected && styles.dateBadgeTextSelected]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.inputLabel}>Franja horaria</Text>
              {slots.length === 0 ? (
                <Text style={styles.warningText}>No hay franjas horarias configuradas.</Text>
              ) : (
                <View style={styles.slotsContainer}>
                  {slots.map((slot) => {
                    const isDisabled = isSlotDisabled(slot, slotCapacities);
                    const isSelected = selectedSlot?.id === slot.id;
                    const count = slotCapacities[slot.id] || 0;
                    const totalLimit = slot.max_pedidos;
                    const capacityLabel = totalLimit ? `(${count}/${totalLimit} pedidos)` : '';

                    return (
                      <TouchableOpacity
                        key={slot.id}
                        style={[
                          styles.slotButton,
                          isSelected && styles.slotButtonSelected,
                          isDisabled && styles.slotButtonDisabled,
                        ]}
                        disabled={isDisabled}
                        onPress={() => setSelectedSlot(slot)}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MaterialCommunityIcons
                              name={isSelected ? "clock-check" : "clock-outline"}
                              size={18}
                              color={isDisabled ? "#94a3b8" : (isSelected ? Colors.primary : Colors.textSecondary)}
                            />
                            <Text style={[
                              styles.slotText,
                              isSelected && styles.slotTextSelected,
                              isDisabled && styles.slotTextDisabled
                            ]}>
                              {slot.nombre}: {slot.hora_inicio} a {slot.hora_fin} hs
                            </Text>
                          </View>
                          {totalLimit !== null && totalLimit !== undefined && !isDisabled && (
                            <Text style={{ fontSize: 11, color: isSelected ? Colors.primary : '#64748b', fontWeight: 'bold' }}>
                              {capacityLabel}
                            </Text>
                          )}
                        </View>
                        {isDisabled && (
                          <Text style={styles.disabledReasonText}>
                            {totalLimit && count >= totalLimit ? '⚠️ Cupo lleno' : '⏳ Vencida/No disponible'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Mensaje de no disponibilidad */}
              {slots.length > 0 && slots.every(s => isSlotDisabled(s, slotCapacities)) && (
                <View style={styles.noAvailabilityBanner}>
                  <MaterialCommunityIcons name="alert-decagram" size={18} color="#b45309" />
                  <Text style={styles.noAvailabilityText}>
                    No hay disponibilidad de reparto para el día seleccionado. Por favor, elegí otra fecha.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── ¿Cómo abona? (Método de Pago) ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>¿Cómo abonás?</Text>
            <View style={styles.paymentOptions}>

              {/* Opción 1: Efectivo / Contra Entrega */}
              {isMethodAllowed('efectivo') && (
                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === 'efectivo' && styles.paymentOptionSelected,
                  ]}
                  onPress={() => setPaymentMethod('efectivo')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="cash-multiple"
                    size={24}
                    color={paymentMethod === 'efectivo' ? Colors.primary : Colors.textSecondary}
                    style={{ marginRight: 10 }}
                  />
                  <View style={styles.paymentOptionText}>
                    <Text style={[styles.paymentOptionLabel, paymentMethod === 'efectivo' && styles.paymentOptionLabelSelected]}>
                      Contra entrega / Efectivo
                    </Text>
                    <Text style={styles.paymentOptionSub}>Abonás en efectivo cuando recibís tu pedido</Text>
                  </View>
                  <View style={[styles.radioCircle, paymentMethod === 'efectivo' && styles.radioCircleSelected]}>
                    {paymentMethod === 'efectivo' && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              )}

              {paymentMethod === 'efectivo' && isMethodAllowed('efectivo') && (
                <View style={styles.efectivoDetailsBox}>
                  <Text style={styles.inputLabel}>¿Con cuánto vas a abonar? (Opcional)</Text>
                  <TextInput
                    style={styles.efectivoInput}
                    value={efectivoAbonaCon}
                    onChangeText={setEfectivoAbonaCon}
                    placeholder="Ej: 10000"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                  />
                  {Number(efectivoAbonaCon) > total && (
                    <Text style={styles.changeText}>
                      Vuelto estimado: <Text style={{ fontWeight: 'bold', color: '#16a34a' }}>{fmtPrice(Number(efectivoAbonaCon) - total)}</Text>
                    </Text>
                  )}
                </View>
              )}

              {/* Opción 2: Mercado Pago */}
              {isMethodAllowed('mercadopago') && (
                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === 'mercadopago' && styles.paymentOptionSelected,
                  ]}
                  onPress={() => setPaymentMethod('mercadopago')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="credit-card-outline"
                    size={24}
                    color={paymentMethod === 'mercadopago' ? Colors.primary : Colors.textSecondary}
                    style={{ marginRight: 10 }}
                  />
                  <View style={styles.paymentOptionText}>
                    <Text style={[styles.paymentOptionLabel, paymentMethod === 'mercadopago' && styles.paymentOptionLabelSelected]}>
                      Mercado Pago (Tarjeta o dinero en cuenta)
                    </Text>
                    <Text style={styles.paymentOptionSub}>Dinero en cuenta, débito o crédito</Text>
                  </View>
                  <View style={[styles.radioCircle, paymentMethod === 'mercadopago' && styles.radioCircleSelected]}>
                    {paymentMethod === 'mercadopago' && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              )}

              {paymentMethod === 'mercadopago' && isMethodAllowed('mercadopago') && (
                <View style={styles.mpDetailsBox}>
                  <MaterialCommunityIcons name="security" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.mpDetailsText}>
                    Al confirmar, te redirigiremos para realizar el pago.
                  </Text>
                </View>
              )}

              {/* Opción 3: Transferencia Bancaria */}
              {isMethodAllowed('transferencia') && (
                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === 'transferencia' && styles.paymentOptionSelected,
                  ]}
                  onPress={() => setPaymentMethod('transferencia')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="bank"
                    size={24}
                    color={paymentMethod === 'transferencia' ? Colors.primary : Colors.textSecondary}
                    style={{ marginRight: 10 }}
                  />
                  <View style={styles.paymentOptionText}>
                    <Text style={[styles.paymentOptionLabel, paymentMethod === 'transferencia' && styles.paymentOptionLabelSelected]}>
                      Transferencia Bancaria
                    </Text>
                    <Text style={styles.paymentOptionSub}>Mostrar datos bancarios al confirmar</Text>
                  </View>
                  <View style={[styles.radioCircle, paymentMethod === 'transferencia' && styles.radioCircleSelected]}>
                    {paymentMethod === 'transferencia' && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              )}

              {paymentMethod === 'transferencia' && isMethodAllowed('transferencia') && (
                <View style={styles.bankDetailsBox}>
                  <Text style={styles.bankDetailsTitle}>Datos para transferencia:</Text>
                  <View style={styles.bankDetailRow}>
                    <Text style={styles.bankDetailLabel}>Banco:</Text>
                    <Text style={styles.bankDetailValue}>{companySettings?.banco || '—'}</Text>
                  </View>
                  <View style={styles.bankDetailRow}>
                    <Text style={styles.bankDetailLabel}>Titular:</Text>
                    <Text style={styles.bankDetailValue}>{companySettings?.titular || '—'}</Text>
                  </View>
                  <View style={styles.bankDetailRow}>
                    <Text style={styles.bankDetailLabel}>Alias:</Text>
                    <Text style={[styles.bankDetailValue, { fontWeight: 'bold', color: Colors.primary }]}>{companySettings?.alias_cbu || '—'}</Text>
                  </View>
                  <View style={styles.bankDetailRow}>
                    <Text style={styles.bankDetailLabel}>CBU:</Text>
                    <Text style={styles.bankDetailValue}>{companySettings?.cbu || '—'}</Text>
                  </View>
                  <View style={styles.bankDetailRow}>
                    <Text style={styles.bankDetailLabel}>CUIT:</Text>
                    <Text style={styles.bankDetailValue}>{companySettings?.cuit || '—'}</Text>
                  </View>
                  {companySettings?.tipo_cuenta && (
                    <View style={styles.bankDetailRow}>
                      <Text style={styles.bankDetailLabel}>Cuenta:</Text>
                      <Text style={styles.bankDetailValue}>{companySettings.tipo_cuenta}</Text>
                    </View>
                  )}
                  {companySettings?.instrucciones_transferencia && (
                    <Text style={{ fontSize: 12, color: '#1e40af', marginTop: 4, fontStyle: 'italic' }}>
                      ℹ️ {companySettings.instrucciones_transferencia}
                    </Text>
                  )}

                  <TouchableOpacity
                    style={styles.sendReceiptBtn}
                    onPress={() => {
                      const waMessage = buildWhatsAppOrderMessage({
                        orderNum: `PREV-${Date.now().toString().slice(-6)}`,
                        customerName: clientData?.nombre || 'Cliente',
                        customerPhone: clientData?.telefono || '',
                        items: items.map((i) => {
                          const calc = offerService.calculateFinalPrice(i.producto, i.cantidad, clientData?.tipoCliente || 'minorista', useCartStore.getState().promotions);
                          return {
                            name: i.producto.nombre,
                            presentation: i.producto.presentacion,
                            qty: i.cantidad,
                            unitPrice: calc.priceFinal,
                            subtotal: calc.subtotal,
                          };
                        }),
                        total: total,
                        deliveryMethod: deliveryMethod,
                        deliveryDate: deliveryDate || undefined,
                        deliveryTimeSlot: selectedSlot ? `${selectedSlot.hora_inicio} a ${selectedSlot.hora_fin} hs` : undefined,
                        address: selectedAddress ? selectedAddress.direccion : clientData?.direccion,
                        outOfStockPreference: outOfStockPreference,
                        observaciones: observaciones,
                        paymentMethod: 'transferencia',
                        isTransferReceipt: true,
                      });

                      const waTarget = companySettings?.whatsapp_transferencias || companySettings?.whatsapp || '5493511234567';
                      const cleanPhone = waTarget.replace(/[^0-9]/g, '');
                      Linking.openURL(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`);
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="whatsapp" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.sendReceiptBtnText}>Ya realicé la transferencia, enviar comprobante por WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Opción 4: Pago a acordar */}
              {isMethodAllowed('pago_a_acordar') && (
                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === 'pago_a_acordar' && styles.paymentOptionSelected,
                  ]}
                  onPress={() => setPaymentMethod('pago_a_acordar')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="handshake-outline"
                    size={24}
                    color={paymentMethod === 'pago_a_acordar' ? Colors.primary : Colors.textSecondary}
                    style={{ marginRight: 10 }}
                  />
                  <View style={styles.paymentOptionText}>
                    <Text style={[styles.paymentOptionLabel, paymentMethod === 'pago_a_acordar' && styles.paymentOptionLabelSelected]}>
                      Pago a acordar
                    </Text>
                    <Text style={styles.paymentOptionSub}>Coordinar condiciones de pago con la administración</Text>
                  </View>
                  <View style={[styles.radioCircle, paymentMethod === 'pago_a_acordar' && styles.radioCircleSelected]}>
                    {paymentMethod === 'pago_a_acordar' && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              )}

              {paymentMethod === 'pago_a_acordar' && isMethodAllowed('pago_a_acordar') && (
                <View style={styles.acordarDetailsBox}>
                  <MaterialCommunityIcons name="information-outline" size={18} color="#0369a1" style={{ marginRight: 8 }} />
                  <Text style={styles.acordarDetailsText}>
                    Un asesor de Química General Deheza se comunicará con vos para coordinar los detalles y condiciones de pago.
                  </Text>
                </View>
              )}

              {/* Opción 5: Cuenta Corriente */}
              {isMethodAllowed('cuenta_corriente') && (
                <TouchableOpacity
                  style={[
                    styles.paymentOption,
                    paymentMethod === 'cuenta_corriente' && styles.paymentOptionSelected,
                  ]}
                  onPress={() => setPaymentMethod('cuenta_corriente')}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={24}
                    color={paymentMethod === 'cuenta_corriente' ? Colors.primary : Colors.textSecondary}
                    style={{ marginRight: 10 }}
                  />
                  <View style={styles.paymentOptionText}>
                    <Text style={[styles.paymentOptionLabel, paymentMethod === 'cuenta_corriente' && styles.paymentOptionLabelSelected]}>
                      Cuenta Corriente
                    </Text>
                    <Text style={styles.paymentOptionSub}>Imputar el pedido a tu saldo en cuenta corriente</Text>
                  </View>
                  <View style={[styles.radioCircle, paymentMethod === 'cuenta_corriente' && styles.radioCircleSelected]}>
                    {paymentMethod === 'cuenta_corriente' && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              )}

            </View>
          </View>

          {/* ── Preferencia ante falta de stock ── */}
          <View style={styles.section}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <MaterialCommunityIcons name="help-circle-outline" size={20} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>En caso de no contar con algún producto:</Text>
            </View>
            <Text style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: 12 }}>
              ¿Qué preferís que hagamos si algún artículo no tiene stock disponible?
            </Text>

            <View style={styles.paymentOptions}>
              {/* Opción 1: Llamar */}
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  outOfStockPreference === 'llamar' && styles.paymentOptionSelected,
                ]}
                onPress={() => setOutOfStockPreference('llamar')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="phone-in-talk-outline"
                  size={24}
                  color={outOfStockPreference === 'llamar' ? Colors.primary : Colors.textSecondary}
                  style={{ marginRight: 10 }}
                />
                <View style={styles.paymentOptionText}>
                  <Text style={[styles.paymentOptionLabel, outOfStockPreference === 'llamar' && styles.paymentOptionLabelSelected]}>
                    📞 Llamarme para consultar
                  </Text>
                  <Text style={styles.paymentOptionSub}>Nos comunicaremos por teléfono o WhatsApp para coordinar</Text>
                </View>
                <View style={[styles.radioCircle, outOfStockPreference === 'llamar' && styles.radioCircleSelected]}>
                  {outOfStockPreference === 'llamar' && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>

              {/* Opción 2: Reemplazar por similar */}
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  outOfStockPreference === 'reemplazar' && styles.paymentOptionSelected,
                ]}
                onPress={() => setOutOfStockPreference('reemplazar')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="swap-horizontal-bold"
                  size={24}
                  color={outOfStockPreference === 'reemplazar' ? Colors.primary : Colors.textSecondary}
                  style={{ marginRight: 10 }}
                />
                <View style={styles.paymentOptionText}>
                  <Text style={[styles.paymentOptionLabel, outOfStockPreference === 'reemplazar' && styles.paymentOptionLabelSelected]}>
                    🔄 Elegir otro artículo similar por mí
                  </Text>
                  <Text style={styles.paymentOptionSub}>Reemplazaremos por una alternativa similar de igual o mejor calidad</Text>
                </View>
                <View style={[styles.radioCircle, outOfStockPreference === 'reemplazar' && styles.radioCircleSelected]}>
                  {outOfStockPreference === 'reemplazar' && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Observaciones ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observaciones (opcional)</Text>
            <TextInput
              style={styles.observacionesInput}
              value={observaciones}
              onChangeText={setObservaciones}
              placeholder="Ej: Entrega en portería, llamar antes, horario preferido..."
              placeholderTextColor={Colors.textDisabled}
              multiline
              numberOfLines={3}
              maxLength={300}
              textAlignVertical="top"
            />
            <Text style={styles.observacionesCounter}>{observaciones.length}/300</Text>
          </View>

          {/* ── Resumen ── */}
          <View style={styles.section}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Resumen del pedido</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Artículos</Text>
                <Text style={styles.summaryValue}>{count}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Entrega</Text>
                <Text style={styles.summaryValue}>
                  {DELIVERY_OPTIONS.find((o) => o.key === deliveryMethod)?.label}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Ante falta de stock</Text>
                <Text style={[styles.summaryValue, { fontWeight: '600', color: Colors.primary }]}>
                  {outOfStockPreference === 'llamar' ? '📞 Llamarme' : '🔄 Artículo similar'}
                </Text>
              </View>
              {deliveryMethod !== 'retiro' && selectedSlot && (
                <>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Fecha de reparto</Text>
                    <Text style={styles.summaryValue}>{deliveryDate}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Horario estimado</Text>
                    <Text style={styles.summaryValue}>
                      {selectedSlot.nombre} ({selectedSlot.hora_inicio} a {selectedSlot.hora_fin} hs)
                    </Text>
                  </View>
                </>
              )}

              <View style={[styles.summaryRow, styles.summaryRowTotal]}>
                <Text style={styles.summaryTotalLabel}>Total estimado</Text>
                <Text style={styles.summaryTotalAmount}>{fmtPrice(total)}</Text>
              </View>
            </View>
          </View>

          {/* ── Botón confirmar ── */}
          <View style={styles.confirmSection}>
            <Button
              title={deliveryMethod === 'whatsapp' ? '💬  Enviar por WhatsApp' : '✓  Confirmar pedido'}
              variant={deliveryMethod === 'whatsapp' ? 'success' : 'success'}
              size="lg"
              disabled={minOrderAmount > 0 && deliveryMethod !== 'retiro' && deliveryMethod !== 'whatsapp' && total < minOrderAmount}
              onPress={handleConfirmOrder}
            />
            {minOrderAmount > 0 && deliveryMethod !== 'retiro' && deliveryMethod !== 'whatsapp' && total < minOrderAmount && (
              <Text style={[styles.confirmDisclaimer, { color: '#b91c1c', textAlign: 'center', marginTop: 6 }]}>
                El monto mínimo para hacer un pedido es {fmtPrice(minOrderAmount)}.
              </Text>
            )}
            <Text style={styles.confirmDisclaimer}>
              * Los precios son estimados. El precio final puede variar según disponibilidad.
            </Text>
          </View>

          {/* Historial de Pedidos del Pasado */}
          <View style={[styles.section, { marginTop: Spacing.xxl }]}>
            <Text style={styles.sectionTitle}>Historial de pedidos ({clientOrders.length})</Text>
            {clientOrders.length === 0 ? (
              <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginVertical: 20 }}>No tenés pedidos registrados todavía.</Text>
            ) : (
              clientOrders.map((o) => (
                <View key={o.id} style={styles.orderHistoryCard}>
                  <View style={styles.orderHistoryHeader}>
                    <Text style={styles.orderHistoryNumber}>Pedido #{o.numero}</Text>
                    <Text style={[styles.orderHistoryStatus, { color: Colors.primary }]}>{o.estado.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.orderHistoryDate}>
                    Fecha: {new Date(o.fecha).toLocaleDateString()}
                  </Text>
                  {o.deliveryDate && (
                    <Text style={styles.orderHistoryDelivery}>
                      Entrega: {o.deliveryDate} ({o.deliveryStartTime} a {o.deliveryEndTime} hs)
                    </Text>
                  )}
                  <Text style={styles.orderHistoryTotal}>
                    Monto total: {fmtPrice(o.total)}
                  </Text>
                  <TouchableOpacity style={styles.orderHistoryRepeatBtn} onPress={() => handleRepeatOrder(o)} activeOpacity={0.8}>
                    <Text style={styles.orderHistoryRepeatBtnText}>🔄 Volver a comprar</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          <View style={{ height: Spacing.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────────────
// Componente: fila de item del carrito
// ──────────────────────────────────────────────────────────────
function CartItemRow({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: CartItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  const { producto, cantidad } = item;
  const promotions = useCartStore((state) => state.promotions);
  const customerType = useAuthStore((state) => state.clientData?.tipoCliente || 'minorista');

  const calculation = offerService.calculateFinalPrice(
    producto,
    cantidad,
    customerType,
    promotions
  );

  const icon = CATEGORY_ICONS[producto.categoria];

  return (
    <View style={rowStyles.container}>
      {/* Ícono de categoría */}
      <View style={rowStyles.iconContainer}>
        <MaterialCommunityIcons name={icon as any} size={28} color={Colors.primary} />
      </View>

      {/* Info del producto */}
      <View style={rowStyles.info}>
        <Text style={rowStyles.nombre} numberOfLines={2}>
          {producto.nombre}
        </Text>
        {producto.presentacion && (
          <Text style={rowStyles.presentacion}>{producto.presentacion}</Text>
        )}
        <Text style={rowStyles.codigo}>{producto.codigo}</Text>

        {calculation.discountPercent > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Text style={[rowStyles.precioUnit, { textDecorationLine: 'line-through', color: '#94a3b8' }]}>
              {fmtPrice(calculation.priceOriginal)}
            </Text>
            <Text style={[rowStyles.precioUnit, { color: '#10b981', fontWeight: 'bold' }]}>
              {fmtPrice(calculation.priceFinal)}
            </Text>
            <View style={{ backgroundColor: '#ecfdf5', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 0.5, borderColor: '#a7f3d0' }}>
              <Text style={{ fontSize: 9, color: '#10b981', fontWeight: 'bold' }}>
                {calculation.discountPercent}% OFF
              </Text>
            </View>
          </View>
        ) : (
          <Text style={rowStyles.precioUnit}>
            {fmtPrice(calculation.priceOriginal)} / {producto.unidad}
          </Text>
        )}
      </View>

      {/* Controles de cantidad + subtotal */}
      <View style={rowStyles.controls}>
        {/* Subtotal */}
        <View style={{ alignItems: 'flex-end', marginBottom: 4 }}>
          {calculation.discountPercent > 0 && (
            <Text style={{ fontSize: 11, color: '#94a3b8', textDecorationLine: 'line-through' }}>
              {fmtPrice(calculation.priceOriginal * cantidad)}
            </Text>
          )}
          <Text style={rowStyles.subtotal}>{fmtPrice(calculation.subtotal)}</Text>
        </View>

        {/* Botones +/− */}
        <View style={rowStyles.quantityRow}>
          <TouchableOpacity
            style={rowStyles.qtyBtn}
            onPress={cantidad === 1 ? onRemove : onDecrease}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={cantidad === 1 ? 'Eliminar producto' : 'Disminuir cantidad'}
          >
            <Text style={rowStyles.qtyBtnText}>{cantidad === 1 ? '🗑' : '−'}</Text>
          </TouchableOpacity>

          <Text style={rowStyles.qty}>{cantidad}</Text>

          <TouchableOpacity
            style={[rowStyles.qtyBtn, rowStyles.qtyBtnAdd]}
            onPress={onIncrease}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Aumentar cantidad"
          >
            <Text style={[rowStyles.qtyBtnText, rowStyles.qtyBtnAddText]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}


// ──────────────────────────────────────────────────────────────
// Estilos del CartItemRow
// ──────────────────────────────────────────────────────────────
const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 28,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  nombre: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  presentacion: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  codigo: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
  },
  precioUnit: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  controls: {
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  subtotal: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 2,
    borderColor: Colors.primary,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  qtyBtnAdd: {
    backgroundColor: Colors.primary,
  },
  qtyBtnText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    lineHeight: 26,
  },
  qtyBtnAddText: {
    color: Colors.white,
  },
  qty: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    minWidth: 34,
    textAlign: 'center',
  },
});

// ──────────────────────────────────────────────────────────────
// Estilos principales
// ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  clearButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.dangerLight,
    borderRadius: Radius.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.danger,
  },

  // Scroll
  scrollContent: {
    paddingBottom: Spacing.huge,
  },

  // Secciones
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

  // Opciones de entrega
  deliveryOptions: {
    gap: Spacing.md,
  },
  deliveryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: Spacing.xl,
    gap: Spacing.md,
    minHeight: 72,
  },
  deliveryOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  deliveryOptionIcon: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  deliveryOptionText: {
    flex: 1,
    gap: 4,
  },
  deliveryOptionLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  deliveryOptionLabelSelected: {
    color: Colors.primary,
  },
  deliveryOptionSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  radioCircleSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },

  // Observaciones
  observacionesInput: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: Spacing.xl,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    minHeight: 100,
    lineHeight: 26,
  },
  observacionesCounter: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    textAlign: 'right',
    marginTop: Spacing.sm,
  },

  // Resumen
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  summaryTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryLabel: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: Spacing.md,
  },
  summaryRowTotal: {
    borderBottomWidth: 0,
    marginTop: Spacing.sm,
  },
  summaryTotalLabel: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  summaryTotalAmount: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -1,
  },

  // Botón confirmar
  confirmSection: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xxl,
    gap: Spacing.md,
  },
  confirmDisclaimer: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Barra de mínimo de compra
  minOrderBar: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: '#fefce8',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  minOrderBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  minOrderBarText: {
    fontSize: FontSize.xs,
    fontWeight: '600' as any,
    color: '#92400e',
    flex: 1,
    flexWrap: 'wrap',
  },
  minOrderBarSubtext: {
    fontSize: FontSize.xs,
    color: '#92400e',
    fontWeight: '500' as any,
    marginLeft: 8,
  },
  minOrderBarTrack: {
    height: 8,
    backgroundColor: '#fde68a',
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  minOrderBarFill: {
    height: 8,
    backgroundColor: '#f59e0b',
    borderRadius: 4,
  },

  // Carrito vacío
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.huge,
  },
  emptyIcon: {
    fontSize: 72,
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  emptySubtitle: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxxl,
  },
  emptyActions: {
    width: '100%',
    gap: Spacing.md,
  },

  // Confirmado
  confirmedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.huge,
    gap: Spacing.lg,
  },
  confirmedIcon: {
    fontSize: 80,
    marginBottom: Spacing.md,
  },
  confirmedTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.success,
    textAlign: 'center',
  },
  confirmedOrderNum: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  confirmedInfoCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    width: '100%',
    marginTop: Spacing.md,
  },
  confirmedInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  confirmedInfoIcon: {
    fontSize: 28,
    width: 36,
    textAlign: 'center',
  },
  confirmedInfoLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  confirmedInfoValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  confirmedSubtitle: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 28,
    marginTop: Spacing.sm,
  },
  confirmedActions: {
    width: '100%',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },

  // Selectores de fecha y franja (Etapa 7)
  inputLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  dateSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  dateBadge: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
  },
  dateBadgeSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dateBadgeText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  dateBadgeTextSelected: {
    color: Colors.white,
  },
  slotsContainer: {
    gap: Spacing.sm,
  },
  slotButton: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    marginBottom: 8,
  },
  slotButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  slotButtonDisabled: {
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  slotText: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  slotTextSelected: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  slotTextDisabled: {
    color: '#94a3b8',
  },
  disabledReasonText: {
    fontSize: 10,
    color: '#ef4444',
    marginTop: 4,
    alignSelf: 'flex-start',
    fontWeight: 'bold',
  },
  noAvailabilityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  noAvailabilityText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: '#b45309',
    lineHeight: 20,
    fontWeight: '600',
  },
  warningText: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    fontWeight: 'bold',
  },

  // Métodos de pago
  paymentOptions: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  paymentOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  paymentOptionText: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  paymentOptionLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  paymentOptionLabelSelected: {
    color: Colors.primary,
    fontWeight: 'bold',
  },
  paymentOptionSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  efectivoDetailsBox: {
    padding: Spacing.lg,
    backgroundColor: '#f8fafc',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: -8,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  efectivoInput: {
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  changeText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  mpDetailsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.15)',
    marginTop: -8,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  mpDetailsText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
  },
  acordarDetailsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: '#f0f9ff',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginTop: -8,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  acordarDetailsText: {
    flex: 1,
    fontSize: 13,
    color: '#0369a1',
    fontWeight: '500',
    lineHeight: 18,
  },
  bankDetailsBox: {
    padding: Spacing.xl,
    backgroundColor: '#f8fafc',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: -8,
    marginBottom: 8,
    marginHorizontal: 4,
    gap: 8,
  },
  bankDetailsTitle: {
    fontSize: 14,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  bankDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  bankDetailLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  bankDetailValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  sendReceiptBtn: {
    marginTop: 10,
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  sendReceiptBtnText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    flexShrink: 1,
  },

  // Cuadro confirmado banco
  confirmedBankCard: {
    backgroundColor: '#f8fafc',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    width: '100%',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  bankCardTitle: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  bankCardSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  bankCardDetails: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.lg,
    gap: 6,
  },
  bankCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bankCardLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  bankCardVal: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  orderHistoryCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  orderHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderHistoryNumber: {
    fontSize: 15,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  orderHistoryStatus: {
    fontSize: 12,
    fontWeight: FontWeight.bold,
  },
  orderHistoryDate: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  orderHistoryDelivery: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
  },
  orderHistoryTotal: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.md,
  },
  orderHistoryRepeatBtn: {
    backgroundColor: Colors.primaryLight,
    height: 38,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderHistoryRepeatBtnText: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    fontSize: 12,
  },
  loadingOrderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.background,
  },
  loadingOrderCard: {
    backgroundColor: Colors.white,
    padding: Spacing.xxl,
    borderRadius: Radius.lg,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  loadingOrderTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  loadingOrderSub: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});

