import { create } from 'zustand';
import { CartItem, Product, Order, OrderItem } from '../types';
import { offerService, Promotion } from '@shared/services/offerService';

interface CartStore {
  items: CartItem[];
  promotions: Promotion[];

  // Acciones
  addProduct: (producto: Product, cantidad?: number, silent?: boolean) => void;
  removeProduct: (productoId: string) => void;
  updateQuantity: (productoId: string, cantidad: number) => void;
  clearCart: () => void;
  repeatOrder: (order: Order) => void;
  fetchPromotions: () => Promise<void>;

  // Computed values
  totalItems: () => number;
  totalPrice: () => number;
  getItemQuantity: (productoId: string) => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  promotions: [],

  fetchPromotions: async () => {
    try {
      const activePromos = await offerService.getActivePromotions();
      set({ promotions: activePromos });
    } catch (err) {
      console.error('Error fetching promotions in cartStore:', err);
    }
  },

  addProduct: (producto, cantidad = 1, silent = false) => {
    // Fetch promotions if empty
    if (get().promotions.length === 0) {
      get().fetchPromotions();
    }

    set((state) => {
      const existingIndex = state.items.findIndex(
        (item) => item.producto.id === producto.id
      );

      let newItems = [...state.items];
      if (existingIndex >= 0) {
        // Si ya existe, incrementar cantidad
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          cantidad: newItems[existingIndex].cantidad + cantidad,
        };
      } else {
        // Agregar nuevo item
        newItems.push({ producto, cantidad });
      }

      if (!silent) {
        // Disparar toast no bloqueante
        setTimeout(() => {
          try {
            const { useNotificationStore } = require('./useNotificationStore');
            const { router } = require('expo-router');
            useNotificationStore.getState().showToast({
              message: 'Producto agregado al carrito.',
              type: 'success',
              actionLabel: 'Ver carrito',
              onAction: () => {
                router.push('/(tabs)/carrito');
              },
              secondaryActionLabel: 'Seguir comprando',
              onSecondaryAction: () => {},
            });
          } catch (err) {
            console.error('Error triggering toast:', err);
          }
        }, 50);
      }

      return { items: newItems };
    });
  },

  removeProduct: (productoId) => {
    set((state) => ({
      items: state.items.filter((item) => item.producto.id !== productoId),
    }));
  },

  updateQuantity: (productoId, cantidad) => {
    if (cantidad <= 0) {
      get().removeProduct(productoId);
      return;
    }
    set((state) => ({
      items: state.items.map((item) =>
        item.producto.id === productoId ? { ...item, cantidad } : item
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

  repeatOrder: (order) => {
    // Fetch promotions if empty
    if (get().promotions.length === 0) {
      get().fetchPromotions();
    }

    const items: CartItem[] = order.items.map((orderItem) => ({
      producto: orderItem.producto,
      shadowCopy: true,
      cantidad: orderItem.cantidad,
    } as any));
    set({ items });

    // Disparar toast de repetición
    setTimeout(() => {
      try {
        const { useNotificationStore } = require('./useNotificationStore');
        const { router } = require('expo-router');
        useNotificationStore.getState().showToast({
          message: 'Pedido repetido. Los productos se agregaron a tu carrito.',
          type: 'success',
          actionLabel: 'Ver carrito',
          onAction: () => {
            router.push('/(tabs)/carrito');
          },
          secondaryActionLabel: 'Seguir comprando',
          onSecondaryAction: () => {},
        });
      } catch (err) {
        console.error('Error triggering repeat toast:', err);
      }
    }, 50);
  },

  totalItems: () => {
    return get().items.reduce((sum, item) => sum + item.cantidad, 0);
  },

  totalPrice: () => {
    const { items, promotions } = get();
    // Load authStore dynamically to avoid cycle
    let customerType: 'mayorista' | 'minorista' = 'minorista';
    try {
      const { useAuthStore } = require('./authStore');
      customerType = useAuthStore.getState().clientData?.tipoCliente || 'minorista';
    } catch (err) {
      // ignore
    }

    return items.reduce((sum, item) => {
      const calculation = offerService.calculateFinalPrice(
        item.producto,
        item.cantidad,
        customerType,
        promotions
      );
      return sum + calculation.subtotal;
    }, 0);
  },

  getItemQuantity: (productoId) => {
    const item = get().items.find((i) => i.producto.id === productoId);
    return item?.cantidad ?? 0;
  },
}));

