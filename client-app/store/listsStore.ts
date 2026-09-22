import { create } from 'zustand';
import { UserList, UserListItem, listService } from '@shared/services/listService';
import { supabase } from '@shared/services/supabaseClient';
import { useAuthStore } from './authStore';
import { useCartStore } from './cartStore';
import { useNotificationStore } from './useNotificationStore';
import { Product } from '../types';

// Limpieza de cualquier almacenamiento local previo de listas
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    window.localStorage.removeItem('qgd_user_lists');
  } catch (_) {}
}

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

// Obtiene todos los identificadores posibles del usuario actual (id de customer, user_id, auth uid)
const getUserIdentifiers = async (): Promise<string[]> => {
  let client = useAuthStore.getState().clientData;
  if (!client) {
    // Breve espera por si auth-storage está hidratando el perfil
    await new Promise((res) => setTimeout(res, 200));
    client = useAuthStore.getState().clientData;
  }
  const ids: string[] = [];
  if (client?.id) ids.push(String(client.id));
  if ((client as any)?.user_id) ids.push(String((client as any).user_id));
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) ids.push(data.user.id);
  } catch (_) {}
  return Array.from(new Set(ids));
};

const getUserId = async (): Promise<string | null> => {
  const ids = await getUserIdentifiers();
  return ids[0] || null;
};

export const useListsStore = create<ListsStore>()((set, get) => ({
  lists: [],
  isLoading: false,
  activeListId: null,

  setActiveListId: (id) => set({ activeListId: id }),

  fetchLists: async () => {
    set({ isLoading: true });
    try {
      const userIds = await getUserIdentifiers();
      if (userIds.length === 0) {
        set({ lists: [], isLoading: false });
        return;
      }

      const serverLists = await listService.getUserLists(userIds);
      set({ lists: serverLists || [], isLoading: false });
    } catch (err: any) {
      console.warn('Error al cargar listas de Supabase:', err?.message || err);
      set({ lists: [], isLoading: false });
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
      set((state) => ({
        lists: [newList, ...state.lists.filter((l) => String(l.id) !== String(newList.id))],
      }));
      useNotificationStore.getState().showToast({
        message: `Lista "${nombre}" creada con éxito.`,
        type: 'success',
      });
      return newList;
    } catch (err: any) {
      console.error('Error al crear lista en Supabase:', err);
      useNotificationStore.getState().showToast({
        message: `Error al crear la lista en Supabase: ${err?.message || 'Error de conexión'}`,
        type: 'error',
      });
      return null;
    }
  },

  updateList: async (listId, nombre, descripcion) => {
    try {
      await listService.updateList(listId, nombre, descripcion);
    } catch (err: any) {
      console.warn('Advertencia al actualizar lista en servidor:', err);
    }

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
  },

  deleteList: async (listId) => {
    try {
      await listService.deleteList(listId);
    } catch (err: any) {
      console.warn('Advertencia al eliminar lista en servidor:', err);
    }

    set((state) => ({
      lists: state.lists.filter((l) => String(l.id) !== String(listId)),
      activeListId: state.activeListId === listId ? null : state.activeListId,
    }));

    useNotificationStore.getState().showToast({
      message: 'Lista eliminada.',
      type: 'info',
    });
    return true;
  },

  addItemToList: async (listId, product) => {
    try {
      await listService.addItemToList(listId, product.id);
    } catch (err: any) {
      console.warn('Advertencia al sincronizar ítem en servidor:', err);
    }

    const itemWithProduct: UserListItem = {
      id: Date.now(),
      listId,
      productId: product.id,
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
  },

  removeItemFromList: async (listId, productId) => {
    try {
      await listService.removeItemFromList(listId, productId);
    } catch (err: any) {
      console.warn('Advertencia al quitar ítem en servidor:', err);
    }

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
