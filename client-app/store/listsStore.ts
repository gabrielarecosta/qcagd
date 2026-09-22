import { create } from 'zustand';
import { UserList, UserListItem, listService } from '@shared/services/listService';
import { supabase } from '@shared/services/supabaseClient';
import { useAuthStore } from './authStore';
import { useCartStore } from './cartStore';
import { useNotificationStore } from './useNotificationStore';
import { Product } from '../types';

interface ListsStore {
  lists: UserList[];
  isLoading: boolean;
  activeListId: string | number | null;

  setActiveListId: (id: string | number | null) => void;
  fetchLists: () => Promise<void>;
  createList: (nombre: string, descripcion?: string) => Promise<UserList | null>;
  updateList: (listId: string | number, nombre: string, descripcion?: string) => Promise<boolean>;
  deleteList: (listId: string | number) => Promise<boolean>;
  addItemToList: (listId: string | number, product: Product) => Promise<boolean>;
  removeItemFromList: (listId: string | number, productId: string | number) => Promise<boolean>;
  isProductInList: (listId: string | number, productId: string | number) => boolean;
  isProductInAnyList: (productId: string | number) => boolean;

  // Carrito
  getCartConflicts: (listId: string | number) => Product[];
  addSingleProductToCart: (product: Product, mode: 'add' | 'replace') => void;
  addListToCart: (listId: string | number, mode: 'add' | 'replace') => void;
}

const getUserId = async (): Promise<string | null> => {
  const client = useAuthStore.getState().clientData;
  if (client?.id) return String(client.id);
  if ((client as any)?.user_id) return String((client as any).user_id);
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) return data.user.id;
  } catch (_) {}
  return null;
};

export const useListsStore = create<ListsStore>((set, get) => ({
  lists: [],
  isLoading: false,
  activeListId: null,

  setActiveListId: (id) => set({ activeListId: id }),

  fetchLists: async () => {
    const userId = await getUserId();
    if (!userId) {
      set({ lists: [] });
      return;
    }
    set({ isLoading: true });
    try {
      const lists = await listService.getUserLists(userId);
      set({ lists, isLoading: false });
    } catch (err: any) {
      console.warn('Error al cargar listas:', err?.message || err);
      set({ isLoading: false });
    }
  },

  createList: async (nombre, descripcion) => {
    const userId = await getUserId();
    if (!userId) {
      useNotificationStore.getState().showToast({
        message: 'Debes iniciar sesión para crear una lista.',
        type: 'warning',
      });
      return null;
    }
    try {
      const newList = await listService.createList(userId, nombre, descripcion);
      set((state) => ({ lists: [newList, ...state.lists] }));
      useNotificationStore.getState().showToast({
        message: `Lista "${nombre}" creada con éxito.`,
        type: 'success',
      });
      return newList;
    } catch (err: any) {
      console.error('Error al crear lista:', err);
      useNotificationStore.getState().showToast({
        message: 'No se pudo crear la lista.',
        type: 'error',
      });
      return null;
    }
  },

  updateList: async (listId, nombre, descripcion) => {
    try {
      await listService.updateList(listId, nombre, descripcion);
      set((state) => ({
        lists: state.lists.map((l) =>
          String(l.id) === String(listId)
            ? { ...l, nombre: nombre.trim(), descripcion: descripcion?.trim() || undefined }
            : l
        ),
      }));
      useNotificationStore.getState().showToast({
        message: 'Lista actualizada correctamente.',
        type: 'success',
      });
      return true;
    } catch (err: any) {
      console.error('Error al actualizar lista:', err);
      useNotificationStore.getState().showToast({
        message: 'No se pudo actualizar la lista.',
        type: 'error',
      });
      return false;
    }
  },

  deleteList: async (listId) => {
    try {
      await listService.deleteList(listId);
      set((state) => ({
        lists: state.lists.filter((l) => String(l.id) !== String(listId)),
        activeListId: state.activeListId === listId ? null : state.activeListId,
      }));
      useNotificationStore.getState().showToast({
        message: 'Lista eliminada.',
        type: 'info',
      });
      return true;
    } catch (err: any) {
      console.error('Error al eliminar lista:', err);
      useNotificationStore.getState().showToast({
        message: 'No se pudo eliminar la lista.',
        type: 'error',
      });
      return false;
    }
  },

  addItemToList: async (listId, product) => {
    try {
      const item = await listService.addItemToList(listId, product.id);
      // Adjuntar el producto al item localmente
      const itemWithProduct: UserListItem = {
        ...item,
        product,
      };

      set((state) => ({
        lists: state.lists.map((l) => {
          if (String(l.id) !== String(listId)) return l;
          const exists = l.items.some((i) => String(i.productId) === String(product.id));
          if (exists) return l;
          return {
            ...l,
            items: [...l.items, itemWithProduct],
          };
        }),
      }));

      useNotificationStore.getState().showToast({
        message: `"${product.nombre}" agregado a la lista.`,
        type: 'success',
      });
      return true;
    } catch (err: any) {
      console.error('Error al agregar item a lista:', err);
      useNotificationStore.getState().showToast({
        message: 'No se pudo agregar a la lista.',
        type: 'error',
      });
      return false;
    }
  },

  removeItemFromList: async (listId, productId) => {
    try {
      await listService.removeItemFromList(listId, productId);
      set((state) => ({
        lists: state.lists.map((l) => {
          if (String(l.id) !== String(listId)) return l;
          return {
            ...l,
            items: l.items.filter((i) => String(i.productId) !== String(productId)),
          };
        }),
      }));
      useNotificationStore.getState().showToast({
        message: 'Producto quitado de la lista.',
        type: 'info',
      });
      return true;
    } catch (err: any) {
      console.error('Error al quitar item de lista:', err);
      useNotificationStore.getState().showToast({
        message: 'No se pudo quitar de la lista.',
        type: 'error',
      });
      return false;
    }
  },

  isProductInList: (listId, productId) => {
    const list = get().lists.find((l) => String(l.id) === String(listId));
    if (!list) return false;
    return list.items.some((i) => String(i.productId) === String(productId));
  },

  isProductInAnyList: (productId) => {
    return get().lists.some((l) =>
      l.items.some((i) => String(i.productId) === String(productId))
    );
  },

  getCartConflicts: (listId) => {
    const list = get().lists.find((l) => String(l.id) === String(listId));
    if (!list || !list.items.length) return [];

    const cartItems = useCartStore.getState().items;
    const cartProductIds = new Set(cartItems.map((ci) => String(ci.producto.id)));

    const conflicts: Product[] = [];
    list.items.forEach((item) => {
      if (cartProductIds.has(String(item.productId)) && item.product) {
        conflicts.push(item.product);
      }
    });

    return conflicts;
  },

  addSingleProductToCart: (product, mode = 'add') => {
    const cart = useCartStore.getState();
    const existingIndex = cart.items.findIndex(
      (ci) => String(ci.producto.id) === String(product.id)
    );

    if (mode === 'replace' && existingIndex >= 0) {
      cart.updateQuantity(product.id, 1);
      useNotificationStore.getState().showToast({
        message: `Cantidad de "${product.nombre}" fijada en 1.`,
        type: 'success',
      });
    } else {
      cart.addProduct(product, 1);
    }
  },

  addListToCart: (listId, mode = 'add') => {
    const list = get().lists.find((l) => String(l.id) === String(listId));
    if (!list || !list.items.length) return;

    const cart = useCartStore.getState();

    if (mode === 'replace') {
      cart.clearCart();
      list.items.forEach((item) => {
        if (item.product) {
          cart.addProduct(item.product, 1, true);
        }
      });
      useNotificationStore.getState().showToast({
        message: `Carrito reemplazado con los productos de "${list.nombre}".`,
        type: 'success',
      });
    } else {
      // 'add' (sumar)
      list.items.forEach((item) => {
        if (item.product) {
          cart.addProduct(item.product, 1, true);
        }
      });
      useNotificationStore.getState().showToast({
        message: `Productos de "${list.nombre}" sumados al carrito.`,
        type: 'success',
      });
    }
  },
}));
