import { create } from 'zustand';
import { CartItem, Product, Order } from '../types';
import { offerService, Promotion } from '@shared/services/offerService';
import { cartService } from '@shared/services/cartService';

const GUEST_CART_STORAGE_KEY = 'qgd_guest_cart';

const safeStorage = {
  getItem: (name: string): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(name);
      } catch (_) {
        return null;
      }
    }
    return null;
  },
  setItem: (name: string, value: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(name, value);
      } catch (_) {}
    }
  },
  removeItem: (name: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(name);
      } catch (_) {}
    }
  },
};

// Función auxiliar para ordenar items alfabéticamente por nombre de producto
const sortItemsAlphabetically = (items: CartItem[]): CartItem[] => {
  return [...items].sort((a, b) =>
    (a.producto?.nombre || '').localeCompare(b.producto?.nombre || '', 'es', { sensitivity: 'base' })
  );
};

const getInitialCartItems = (): CartItem[] => {
  const stored = safeStorage.getItem(GUEST_CART_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortItemsAlphabetically(parsed);
      }
    } catch (_) {}
  }
  return [];
};

const saveLocalCartItems = (items: CartItem[]) => {
  if (items && items.length > 0) {
    safeStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(items));
  } else {
    safeStorage.removeItem(GUEST_CART_STORAGE_KEY);
  }
};

interface CartStore {
  items: CartItem[];
  promotions: Promotion[];
  isLoadingServerCart: boolean;

  // Acciones
  addProduct: (producto: Product, cantidad?: number, silent?: boolean) => void;
  removeProduct: (productoId: string | number) => void;
  updateQuantity: (productoId: string | number, cantidad: number) => void;
  clearCart: () => void;
  repeatOrder: (order: Order) => void;
  fetchPromotions: () => Promise<void>;

  // Sincronización DB + Front
  loadCartForUser: (userId: string) => Promise<void>;
  syncWithServer: () => Promise<void>;

  // Computed values
  totalItems: () => number;
  totalPrice: () => number;
  getItemQuantity: (productoId: string | number) => number;
}

// Función auxiliar para sincronizar el carrito actual con Supabase DB si hay usuario autenticado
const syncCartToSupabase = (items: CartItem[]) => {
  setTimeout(async () => {
    try {
      const { useAuthStore } = require('./authStore');
      const authState = useAuthStore.getState();
      const client = authState.clientData;
      const userId = client?.id || (client as any)?.user_id;

      if (userId) {
        await cartService.saveUserCart(String(userId), items);
      }
    } catch (err) {
      console.warn('Error al sincronizar carrito con Supabase DB:', err);
    }
  }, 100);
};

export const useCartStore = create<CartStore>()((set, get) => ({
  items: getInitialCartItems(),
  promotions: [],
  isLoadingServerCart: false,

  fetchPromotions: async () => {
    try {
      const activePromos = await offerService.getActivePromotions();
      set({ promotions: activePromos });
    } catch (err) {
      console.error('Error fetching promotions in cartStore:', err);
    }
  },

  loadCartForUser: async (userId: string) => {
    if (!userId) return;
    set({ isLoadingServerCart: true });
    try {
      const serverItems = await cartService.getByUserId(String(userId));
      const currentGuestItems = get().items;

      let merged: CartItem[] = [];
      if (serverItems && serverItems.length > 0) {
        merged = [...serverItems];
        // Incorporar items que el usuario agregó mientras no estaba logueado
        if (currentGuestItems && currentGuestItems.length > 0) {
          currentGuestItems.forEach((gItem) => {
            const existingIdx = merged.findIndex((m) => String(m.producto.id) === String(gItem.producto.id));
            if (existingIdx === -1) {
              merged.push(gItem);
            } else {
              merged[existingIdx].cantidad = Math.max(merged[existingIdx].cantidad, gItem.cantidad);
            }
          });
        }
      } else if (currentGuestItems && currentGuestItems.length > 0) {
        merged = currentGuestItems;
      }

      const sorted = sortItemsAlphabetically(merged);
      saveLocalCartItems(sorted);
      set({ items: sorted, isLoadingServerCart: false });
      if (merged.length > 0) {
        syncCartToSupabase(sorted);
      }
    } catch (err) {
      console.error('Error al cargar carrito desde el servidor:', err);
      set({ isLoadingServerCart: false });
    }
  },

  syncWithServer: async () => {
    const items = get().items;
    saveLocalCartItems(items);
    syncCartToSupabase(items);
  },

  addProduct: (producto, cantidad = 1, silent = false) => {
    if (get().promotions.length === 0) {
      get().fetchPromotions();
    }

    set((state) => {
      const existingIndex = state.items.findIndex(
        (item) => String(item.producto.id) === String(producto.id)
      );

      let newItems = [...state.items];
      if (existingIndex >= 0) {
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          cantidad: newItems[existingIndex].cantidad + cantidad,
        };
      } else {
        newItems.push({ producto, cantidad });
      }

      // Ordenar alfabéticamente los productos en el carrito
      newItems = sortItemsAlphabetically(newItems);

      if (!silent) {
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

      // Guardar en almacenamiento local para persistencia entre recargas y sincronizar a DB
      saveLocalCartItems(newItems);
      syncCartToSupabase(newItems);

      return { items: newItems };
    });
  },

  removeProduct: (productoId) => {
    set((state) => {
      const newItems = state.items.filter(
        (item) => String(item.producto.id) !== String(productoId)
      );
      saveLocalCartItems(newItems);
      syncCartToSupabase(newItems);
      return { items: newItems };
    });
  },

  updateQuantity: (productoId, cantidad) => {
    if (cantidad <= 0) {
      get().removeProduct(productoId);
      return;
    }
    set((state) => {
      const newItems = state.items.map((item) =>
        String(item.producto.id) === String(productoId)
          ? { ...item, cantidad }
          : item
      );
      saveLocalCartItems(newItems);
      syncCartToSupabase(newItems);
      return { items: newItems };
    });
  },

  clearCart: () => {
    saveLocalCartItems([]);
    const { useAuthStore } = require('./authStore');
    const client = useAuthStore.getState().clientData;
    const userId = client?.id || client?.user_id;

    set({ items: [] });

    if (userId) {
      cartService.clearUserCart(String(userId));
    }
  },

  repeatOrder: (order) => {
    if (get().promotions.length === 0) {
      get().fetchPromotions();
    }

    const items: CartItem[] = order.items.map((orderItem) => ({
      producto: orderItem.producto,
      shadowCopy: true,
      cantidad: orderItem.cantidad,
    } as any));

    const sorted = sortItemsAlphabetically(items);
    saveLocalCartItems(sorted);
    set({ items: sorted });
    syncCartToSupabase(sorted);

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
    let customerType: string = 'minorista';
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
    const item = get().items.find(
      (i) => String(i.producto.id) === String(productoId)
    );
    return item?.cantidad ?? 0;
  },
}));

