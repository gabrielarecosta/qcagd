import { create } from 'zustand';
import { Order, OrderStatus } from '../types';
import { orderService } from '@shared/services/orderService';

interface OrderStore {
  orders: Order[];
  isLoading: boolean;
  
  fetchOrders: (clienteId?: string, repartidorId?: string) => Promise<void>;
  addOrder: (order: Order, userEmail?: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus, userEmail?: string) => Promise<void>;
  takeOrder: (orderId: string, repartidorId: string, userEmail?: string) => Promise<void>;
  
  activeDeliveryOrder: () => Order | undefined;
  deliveredOrders: () => Order[];
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  orders: [],
  isLoading: false,

  fetchOrders: async (clienteId, repartidorId) => {
    set({ isLoading: true });
    try {
      const data = await orderService.getAll() as any[];
      let filtered = data;
      if (clienteId) {
        filtered = filtered.filter(o => o.clienteId === clienteId);
      }
      if (repartidorId) {
        filtered = filtered.filter(o => o.repartidorId === repartidorId);
      }
      set({ orders: filtered as Order[], isLoading: false });
    } catch (e) {
      console.error('Error fetching orders in mobile:', e);
      set({ isLoading: false });
    }
  },

  addOrder: async (order, userEmail) => {
    const email = userEmail || '';
    await orderService.create(order as any, email);
    await get().fetchOrders(order.clienteId);
  },

  updateOrderStatus: async (orderId, status, userEmail) => {
    const email = userEmail || '';
    await orderService.update(orderId, { estado: status } as any, email);
    
    // Optimistic local state update
    const currentOrders = get().orders;
    set({
      orders: currentOrders.map(o => {
        if (o.id === orderId) {
          const updated = { ...o, estado: status };
          if (status === 'entregado') {
            updated.estimatedDelivery = undefined;
          }
          return updated;
        }
        return o;
      })
    });
  },

  takeOrder: async (orderId, repartidorId, userEmail) => {
    const email = userEmail || '';
    const now = new Date().toISOString();
    
    await orderService.update(orderId, {
      repartidorId,
      takenById: repartidorId,
      takenAt: now,
      estado: 'en_preparacion'
    } as any, email);

    // Optimistic local state update
    const currentOrders = get().orders;
    set({
      orders: currentOrders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            repartidorId,
            takenById: repartidorId,
            takenAt: now,
            estado: 'en_preparacion'
          };
        }
        return o;
      })
    });
  },

  activeDeliveryOrder: () => {
    const { orders } = get();
    // Retorna el primer pedido que esté en camino o en preparación o recibido
    return orders.find((o) => 
      o.estado === 'en_camino' || 
      o.estado === 'en_reparto' || 
      o.estado === 'en_preparacion' || 
      o.estado === 'recibido' || 
      o.estado === 'pendiente'
    );
  },

  deliveredOrders: () => {
    const { orders } = get();
    return orders.filter((o) => o.estado === 'entregado');
  },
}));
