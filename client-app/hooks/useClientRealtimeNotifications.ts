import { useEffect, useRef } from 'react';
import { supabase } from '@shared/services/supabaseClient';
import { useAuthStore } from '../store/authStore';
import { useOrderStore } from '../store/orderStore';
import { useNotificationStore } from '../store/useNotificationStore';

export function useClientRealtimeNotifications() {
  const currentClient = useAuthStore((s) => s.currentClient);
  const clienteId = currentClient?.id;
  const notifiedOrderIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!clienteId) return;

    // 1. Canal en tiempo real para cambios de estado en pedidos del cliente
    const ordersChannel = supabase
      .channel(`realtime-client-orders-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `cliente_id=eq.${clienteId}`,
        },
        (payload: any) => {
          const newOrder = payload.new;
          if (!newOrder) return;

          // Si el pedido pasó a 'en_reparto' o 'en_camino'
          if ((newOrder.estado === 'en_reparto' || newOrder.estado === 'en_camino') && !notifiedOrderIdsRef.current.has(newOrder.id)) {
            notifiedOrderIdsRef.current.add(newOrder.id);

            // Actualizar store local de pedidos
            useOrderStore.getState().fetchOrders(clienteId);

            // Disparar Popup / Toast interactivo
            useNotificationStore.getState().showToast({
              message: `🚚 ¡Tu compra está en camino!\nTu pedido #${newOrder.numero || ''} ya fue despachado y se dirige a tu dirección.`,
              type: 'info',
              duration: 8000,
            });
          } else if (newOrder.estado === 'entregado') {
            useOrderStore.getState().fetchOrders(clienteId);
            useNotificationStore.getState().showToast({
              message: `✅ ¡Pedido entregado!\nTu compra #${newOrder.numero || ''} fue entregada exitosamente. ¡Gracias por confiar en Química General Deheza!`,
              type: 'success',
              duration: 6000,
            });
          }
        }
      )
      .subscribe();

    // 2. Canal en tiempo real para notificaciones dirigidas al cliente
    const notifsChannel = supabase
      .channel(`realtime-client-notifs-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `cliente_id=eq.${clienteId}`,
        },
        (payload: any) => {
          const notif = payload.new;
          if (!notif) return;

          useNotificationStore.getState().showToast({
            message: `${notif.titulo}\n${notif.mensaje}`,
            type: notif.titulo?.includes('camino') ? 'info' : 'success',
            duration: 8000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(notifsChannel);
    };
  }, [clienteId]);
}
