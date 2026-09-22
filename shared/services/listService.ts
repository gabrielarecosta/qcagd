import { supabase } from './supabaseClient';

export interface UserListItem {
  id: string | number;
  listId: string | number;
  productId: string | number;
  createdAt?: string;
  product?: any;
}

export interface UserList {
  id: string | number;
  userId: string;
  nombre: string;
  descripcion?: string;
  items: UserListItem[];
  createdAt?: string;
  updatedAt?: string;
}

export const listService = {
  /**
   * Trae todas las listas del usuario, con sus items incluidos.
   */
  getUserLists: async (userId: string): Promise<UserList[]> => {
    try {
      const { data, error } = await supabase
        .from('user_lists')
        .select(`
          id, user_id, nombre, descripcion, created_at, updated_at,
          user_list_items (
            id, list_id, product_id, created_at,
            products (id, codigo, nombre, descripcion, presentacion, precio, unidad, categoria, subcategoria, stock, imagen, destacado, activo, marca)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('does not exist')) {
          console.warn('La tabla user_lists aún no existe en Supabase DB.');
          return [];
        }
        throw error;
      }

      return (data || []).map((l: any) => ({
        id: l.id,
        userId: l.user_id,
        nombre: l.nombre,
        descripcion: l.descripcion,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
        items: (l.user_list_items || []).map((item: any) => ({
          id: item.id,
          listId: item.list_id,
          productId: item.product_id,
          createdAt: item.created_at,
          product: item.products ? {
            id: item.products.id,
            codigo: item.products.codigo,
            nombre: item.products.nombre,
            descripcion: item.products.descripcion,
            presentacion: item.products.presentacion,
            precio: Number(item.products.precio || 0),
            unidad: item.products.unidad || 'unidad',
            categoria: item.products.categoria,
            subcategoria: item.products.subcategoria,
            stock: item.products.stock,
            imagen: item.products.imagen,
            destacado: item.products.destacado,
            activo: item.products.activo,
            marca: item.products.marca,
          } : undefined,
        })),
      }));
    } catch (err: any) {
      if (err?.code === 'PGRST204' || err?.message?.includes('does not exist')) {
        console.warn('La tabla user_lists aún no existe en Supabase DB.');
        return [];
      }
      throw err;
    }
  },

  /**
   * Crea una nueva lista para el usuario.
   */
  createList: async (userId: string, nombre: string, descripcion?: string): Promise<UserList> => {
    const { data, error } = await supabase
      .from('user_lists')
      .insert({ user_id: userId, nombre: nombre.trim(), descripcion: descripcion?.trim() || null })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      userId: data.user_id,
      nombre: data.nombre,
      descripcion: data.descripcion,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      items: [],
    };
  },

  /**
   * Actualiza nombre y descripción de una lista.
   */
  updateList: async (listId: string | number, nombre: string, descripcion?: string): Promise<void> => {
    const { error } = await supabase
      .from('user_lists')
      .update({ nombre: nombre.trim(), descripcion: descripcion?.trim() || null })
      .eq('id', listId);

    if (error) throw error;
  },

  /**
   * Elimina una lista (cascade elimina sus items).
   */
  deleteList: async (listId: string | number): Promise<void> => {
    const { error } = await supabase
      .from('user_lists')
      .delete()
      .eq('id', listId);

    if (error) throw error;
  },

  /**
   * Agrega un producto a una lista (sin cantidad).
   * Ignora si ya existe (UNIQUE constraint manejado con upsert).
   */
  addItemToList: async (listId: string | number, productId: string | number): Promise<UserListItem> => {
    const { data, error } = await supabase
      .from('user_list_items')
      .upsert(
        { list_id: listId, product_id: productId },
        { onConflict: 'list_id,product_id', ignoreDuplicates: true }
      )
      .select()
      .maybeSingle();

    if (error) throw error;

    // Si ya existía (ignoreDuplicates), fetcheamos el item
    if (!data) {
      const { data: existing, error: fetchErr } = await supabase
        .from('user_list_items')
        .select()
        .eq('list_id', listId)
        .eq('product_id', productId)
        .single();

      if (fetchErr) throw fetchErr;

      return {
        id: existing.id,
        listId: existing.list_id,
        productId: existing.product_id,
        createdAt: existing.created_at,
      };
    }

    return {
      id: data.id,
      listId: data.list_id,
      productId: data.product_id,
      createdAt: data.created_at,
    };
  },

  /**
   * Quita un producto de una lista.
   */
  removeItemFromList: async (listId: string | number, productId: string | number): Promise<void> => {
    const { error } = await supabase
      .from('user_list_items')
      .delete()
      .eq('list_id', listId)
      .eq('product_id', productId);

    if (error) throw error;
  },
};
