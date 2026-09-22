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
   * Trae todas las listas del usuario (o array de identificadores posibles), con sus items incluidos.
   */
  getUserLists: async (userIdOrIds: string | string[]): Promise<UserList[]> => {
    try {
      const allIds = Array.isArray(userIdOrIds) ? userIdOrIds.map(String).filter(Boolean) : [String(userIdOrIds)];
      if (allIds.length === 0) return [];

      const numericIds = allIds.filter((id) => /^\d+$/.test(id));
      const uuidIds = allIds.filter((id) => id.includes('-'));

      const fetchedLists: any[] = [];
      const seenIds = new Set<string | number>();

      const runQuery = async (queryIds: string[]) => {
        if (queryIds.length === 0) return;
        try {
          let query = supabase
            .from('user_lists')
            .select(`
              id, user_id, nombre, descripcion, created_at, updated_at,
              user_list_items (
                id, list_id, product_id, created_at,
                products (id, codigo, nombre, descripcion, presentacion, precio, unidad, categoria, subcategoria, imagen, destacado, activo, marca)
              )
            `);

          if (queryIds.length === 1) {
            query = query.eq('user_id', queryIds[0]);
          } else {
            query = query.in('user_id', queryIds);
          }

          const { data, error } = await query.order('created_at', { ascending: false });
          if (!error && data) {
            data.forEach((item: any) => {
              if (!seenIds.has(item.id)) {
                seenIds.add(item.id);
                fetchedLists.push(item);
              }
            });
          }
        } catch (err) {
          console.warn('Advertencia en runQuery para ids:', queryIds, err);
        }
      };

      // Si tenemos UUIDs, intentamos resolver el ID numérico correspondiente en la tabla customers
      if (uuidIds.length > 0) {
        try {
          const { data: custRows } = await supabase
            .from('customers')
            .select('id')
            .in('user_id', uuidIds);
          if (custRows && custRows.length > 0) {
            custRows.forEach((c: any) => {
              if (c?.id && !numericIds.includes(String(c.id))) {
                numericIds.push(String(c.id));
              }
            });
          }
        } catch (_) {}
      }

      // 1. Primero intentar con numericIds (evita 22P02 si user_id es BIGINT)
      if (numericIds.length > 0) {
        await runQuery(numericIds);
      }

      // 2. Solo intentar con uuidIds si no se encontró nada por numericIds y la columna admitiera UUIDs
      if (uuidIds.length > 0 && fetchedLists.length === 0) {
        await runQuery(uuidIds);
      }

      return fetchedLists.map((l: any) => ({
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
            stock: 0,
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
    let targetUserId: any = String(userId);

    // Pre-resolución de UUID a ID numérico para evitar error 22P02
    if (typeof targetUserId === 'string' && targetUserId.includes('-')) {
      try {
        const { data: cust } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', targetUserId)
          .maybeSingle();
        if (cust?.id) {
          targetUserId = cust.id;
        }
      } catch (_) {}
    }

    let { data, error } = await supabase
      .from('user_lists')
      .insert({ user_id: targetUserId, nombre: nombre.trim(), descripcion: descripcion?.trim() || null })
      .select()
      .single();

    // Si aún así falló por 22P02:
    if (error && error.code === '22P02' && typeof targetUserId === 'string' && targetUserId.includes('-')) {
      const { data: cust } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', targetUserId)
        .maybeSingle();

      if (cust?.id) {
        targetUserId = cust.id;
        const retry = await supabase
          .from('user_lists')
          .insert({ user_id: targetUserId, nombre: nombre.trim(), descripcion: descripcion?.trim() || null })
          .select()
          .single();

        if (!retry.error && retry.data) {
          data = retry.data;
          error = null;
        }
      }
    }

    if (error) {
      console.error('Error al crear lista en Supabase:', error.message, error.details, error.hint);
      throw error;
    }

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
    const numListId = typeof listId === 'string' ? parseInt(listId, 10) : listId;
    const { error } = await supabase
      .from('user_lists')
      .update({ nombre: nombre.trim(), descripcion: descripcion?.trim() || null })
      .eq('id', numListId);

    if (error) {
      console.error('Error al actualizar lista en Supabase:', error.message, error.details);
      throw error;
    }
  },

  /**
   * Elimina una lista (cascade elimina sus items).
   */
  deleteList: async (listId: string | number): Promise<void> => {
    const numListId = typeof listId === 'string' ? parseInt(listId, 10) : listId;
    const { error } = await supabase
      .from('user_lists')
      .delete()
      .eq('id', numListId);

    if (error) {
      console.error('Error al eliminar lista en Supabase:', error.message, error.details);
      throw error;
    }
  },

  /**
   * Agrega un producto a una lista (sin cantidad).
   * Ignora si ya existe (UNIQUE constraint manejado con upsert).
   */
  addItemToList: async (listId: string | number, productId: string | number): Promise<UserListItem> => {
    const numListId = typeof listId === 'string' ? parseInt(listId, 10) : listId;
    const numProdId = typeof productId === 'string' ? parseInt(productId, 10) : productId;

    const { data, error } = await supabase
      .from('user_list_items')
      .upsert(
        { list_id: numListId, product_id: numProdId },
        { onConflict: 'list_id,product_id', ignoreDuplicates: true }
      )
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error al agregar item a lista en Supabase:', error.message, error.details);
      throw error;
    }

    // Si ya existía (ignoreDuplicates), fetcheamos el item
    if (!data) {
      const { data: existing, error: fetchErr } = await supabase
        .from('user_list_items')
        .select()
        .eq('list_id', numListId)
        .eq('product_id', numProdId)
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
    const numListId = typeof listId === 'string' ? parseInt(listId, 10) : listId;
    const numProdId = typeof productId === 'string' ? parseInt(productId, 10) : productId;

    const { error } = await supabase
      .from('user_list_items')
      .delete()
      .eq('list_id', numListId)
      .eq('product_id', numProdId);

    if (error) {
      console.error('Error al quitar item de lista en Supabase:', error.message, error.details);
      throw error;
    }
  },
};
