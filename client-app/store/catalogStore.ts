import { create } from 'zustand';
import { Product, ProductCategory } from '../types';
import { productService } from '@shared/services/productService';
import { supabase } from '@shared/services/supabaseClient';
import { useAuthStore } from './authStore';

export interface AppBanner {
  id: string;
  titulo: string;
  subtitulo: string;
  imagen: string;
  linkDestino: string;
  activo: boolean;
}

interface CatalogStore {
  products: Product[];
  totalProductsCount: number;
  currentPage: number;
  totalPagesCount: number;
  pageSize: number;
  superOffers: any[];
  banners: AppBanner[];
  categoryBanners: Record<string, string>;
  categoryNames: Record<string, string>;
  activeCategories: ProductCategory[]; // categorías habilitadas en BD
  isLoading: boolean;
  source: string;
  importedFileName?: string;

  fetchPaginatedProducts: (options?: {
    page?: number;
    pageSize?: number;
    search?: string;
    categoria?: string;
    sortBy?: 'relevante' | 'precio-bajo' | 'precio-alto' | 'mas-vendido';
  }) => Promise<void>;
  fetchProducts: () => Promise<void>;
  fetchSuperOffers: () => Promise<void>;
  fetchBanners: () => Promise<void>;
  fetchCategoryBanners: () => Promise<void>;
  fetchCategoryNames: () => Promise<void>;
  searchProducts: (query: string, categoria?: ProductCategory) => Product[];
  totalProducts: () => number;
}

export const useCatalogStore = create<CatalogStore>((set, get) => ({
  products: [],
  totalProductsCount: 0,
  currentPage: 1,
  totalPagesCount: 1,
  pageSize: 24,
  superOffers: [],
  banners: [],
  categoryBanners: {},
  categoryNames: {},
  activeCategories: [],
  isLoading: true,

  source: 'Supabase',
  importedFileName: undefined,

  fetchPaginatedProducts: async (options = {}) => {
    set({ isLoading: true });
    try {
      const isLoggedIn = useAuthStore.getState().isLoggedIn;
      const res = await productService.getPaginated({
        ...options,
        isPublic: !isLoggedIn,
      });

      set({
        products: res.data,
        totalProductsCount: res.total,
        currentPage: res.page,
        totalPagesCount: res.totalPages,
        pageSize: res.pageSize,
        isLoading: false,
      });
    } catch (e) {
      console.error('Error fetching paginated products:', e);
      set({ isLoading: false });
    }
  },

  fetchProducts: async () => {
    set({ isLoading: true });
    try {
      const isLoggedIn = useAuthStore.getState().isLoggedIn;
      const prods = await productService.getAll(undefined, !isLoggedIn);
      set({ products: prods, totalProductsCount: prods.length, isLoading: false });
    } catch (e) {
      console.error('Error fetching products in mobile app:', e);
      set({ isLoading: false });
    }
  },

  fetchSuperOffers: async () => {
    try {
      const isLoggedIn = useAuthStore.getState().isLoggedIn;
      const offers = await productService.getSuperOffers(!isLoggedIn);
      set({ superOffers: offers.filter((o: any) => o.activo) });
    } catch (e) {
      console.error('Error fetching super offers:', e);
    }
  },

  fetchBanners: async () => {
    try {
      const { data, error } = await supabase
        .from('app_banners')
        .select('*')
        .eq('activo', true)
        .order('orden', { ascending: true });
      if (error) throw error;
      const mapped: AppBanner[] = (data || []).map((b: any) => ({
        id: b.id,
        titulo: b.titulo,
        subtitulo: b.subtitulo || '',
        imagen: b.imagen || '',
        linkDestino: b.link_destino || '',
        activo: b.activo,
      }));
      set({ banners: mapped });
    } catch (e) {
      console.error('Error fetching banners:', e);
    }
  },

  fetchCategoryBanners: async () => {
    try {
      const { data, error } = await supabase
        .from('category_banners')
        .select('*');
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((b: any) => {
        map[b.categoria] = b.imagen;
      });
      set({ categoryBanners: map });
    } catch (e) {
      console.error('Error fetching category banners:', e);
    }
  },

  fetchCategoryNames: async () => {
    try {
      const { data, error } = await supabase
        .from('category_names')
        .select('*');
      if (error) throw error;
      const map: Record<string, string> = {};
      // Las activas: si la columna activa existe filtramos, si no todas activas
      const activeCats: ProductCategory[] = [];
      (data || []).forEach((n: any) => {
        map[n.categoria] = n.nombre;
        // activa puede ser undefined si la migración 34 aún no se ejecutó → tratar como true
        if (n.activa !== false) {
          activeCats.push(n.categoria as ProductCategory);
        }
      });
      set({ categoryNames: map, activeCategories: activeCats });
    } catch (e) {
      console.error('Error fetching category names:', e);
    }
  },

  searchProducts: (query, categoria) => {
    const { products } = get();
    const q = query.toLowerCase().trim();
    return products.filter((p) => {
      if (!p.activo) return false;
      if (categoria && p.categoria !== categoria) return false;
      if (!q) return true;

      return (
        p.nombre.toLowerCase().includes(q) ||
        p.codigo.toLowerCase().includes(q) ||
        (p.presentacion?.toLowerCase().includes(q) ?? false) ||
        (p.descripcion?.toLowerCase().includes(q) ?? false)
      );
    });
  },

  totalProducts: () => {
    return get().products.filter(p => p.activo).length;
  },
}));
