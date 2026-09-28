import { supabase } from './supabaseClient';

export interface CartItemPayload {
  producto: any;
  cantidad: number;
  shadowCopy?: boolean;
}

export interface AbandonedCart {
  userId: string;
  items: CartItemPayload[];
  updatedAt: string;
  createdAt?: string;
  customer?: {
    id: number | string;
    userId?: string;
    nombre: string;
    razonSocial?: string;
    email?: string;
    telefono?: string;
    whatsapp?: string;
    localidad?: string;
    branchId?: number;
    tipoCliente?: string;
  };
  totalEstimated: number;
  totalQuantity: number;
}

export const cartService = {
  /**
   * Obtiene los ítems guardados del carrito de un usuario desde Supabase
   */
  async getByUserId(userId: string): Promise<CartItemPayload[]> {
    if (!userId) return [];
    try {
      const cleanId = String(userId).trim();
      const { data, error } = await supabase
        .from('user_carts')
        .select('items')
        .eq('user_id', cleanId)
        .maybeSingle();

      if (error) {
        // Manejar de forma transparente si la tabla aún no se ha creado en la BD
        if (error.code === 'PGRST204' || error.message?.includes('does not exist')) {
          console.warn('La tabla user_carts aún no existe en Supabase DB.');
          return [];
        }
        console.error('Error al obtener carrito del usuario:', error.message);
        return [];
      }

      if (!data || !Array.isArray(data.items)) {
        return [];
      }

      return data.items as CartItemPayload[];
    } catch (err) {
      console.error('Error imprevisto al obtener carrito:', err);
      return [];
    }
  },

  /**
   * Guarda / Actualiza los ítems del carrito de un usuario en Supabase (UPSERT)
   */
  async saveUserCart(userId: string, items: CartItemPayload[]): Promise<boolean> {
    if (!userId) return false;
    try {
      const cleanId = String(userId).trim();
      const payload = {
        user_id: cleanId,
        items: Array.isArray(items) ? items : [],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_carts')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('does not exist')) {
          return false;
        }
        console.error('Error al guardar carrito del usuario en DB:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error imprevisto al guardar carrito:', err);
      return false;
    }
  },

  /**
   * Vacía o elimina el carrito guardado del usuario en Supabase
   */
  async clearUserCart(userId: string): Promise<boolean> {
    if (!userId) return false;
    try {
      const cleanId = String(userId).trim();
      const { error } = await supabase
        .from('user_carts')
        .update({ items: [], updated_at: new Date().toISOString() })
        .eq('user_id', cleanId);

      if (error) {
        console.error('Error al limpiar carrito del usuario en DB:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error imprevisto al limpiar carrito:', err);
      return false;
    }
  },

  /**
   * Obtiene todos los carritos abandonados (con ítems > 0) con datos de cliente vinculados
   */
  async getAbandonedCarts(branchId?: string | number): Promise<AbandonedCart[]> {
    try {
      const { data: carts, error: cartErr } = await supabase
        .from('user_carts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (cartErr) {
        if (cartErr.code === 'PGRST204' || cartErr.message?.includes('does not exist')) {
          return [];
        }
        console.error('Error al obtener carritos abandonados:', cartErr.message);
        return [];
      }

      if (!carts || carts.length === 0) return [];

      // Filtrar sólo los carritos que tengan al menos 1 producto
      const cartsWithItems = carts.filter(c => Array.isArray(c.items) && c.items.length > 0);
      if (cartsWithItems.length === 0) return [];

      // Obtener todos los clientes para cruzar los datos
      const { data: customers } = await supabase
        .from('customers')
        .select('id, user_id, nombre, razon_social, email, telefono, whatsapp, localidad, branch_id, tipo_cliente')
        .is('deleted_at', null);

      const customerMap = new Map<string, any>();
      (customers || []).forEach(cust => {
        if (cust.id) customerMap.set(String(cust.id).trim(), cust);
        if (cust.user_id) customerMap.set(String(cust.user_id).trim(), cust);
      });

      const parsedBranch = branchId !== undefined && branchId !== null && branchId !== 'all' ? Number(branchId) : undefined;

      const results: AbandonedCart[] = [];

      for (const cart of cartsWithItems) {
        const uid = String(cart.user_id).trim();
        const cust = customerMap.get(uid);

        // Si se especificó una sucursal y conocemos la sucursal del cliente, filtrar
        if (parsedBranch !== undefined && !isNaN(parsedBranch) && cust && cust.branch_id && Number(cust.branch_id) !== parsedBranch) {
          continue;
        }

        const items: CartItemPayload[] = cart.items || [];
        let totalEstimated = 0;
        let totalQuantity = 0;

        for (const it of items) {
          const qty = Number(it.cantidad || 0);
          totalQuantity += qty;
          const p = it.producto || {};
          const price = Number(p.precioFinal ?? p.precioVenta ?? p.precio_venta ?? p.precio ?? 0);
          totalEstimated += price * qty;
        }

        results.push({
          userId: uid,
          items,
          updatedAt: cart.updated_at || cart.created_at || new Date().toISOString(),
          createdAt: cart.created_at,
          customer: cust ? {
            id: cust.id,
            userId: cust.user_id,
            nombre: cust.nombre,
            razonSocial: cust.razon_social,
            email: cust.email,
            telefono: cust.telefono,
            whatsapp: cust.whatsapp,
            localidad: cust.localidad,
            branchId: cust.branch_id,
            tipoCliente: cust.tipo_cliente,
          } : undefined,
          totalEstimated,
          totalQuantity,
        });
      }

      return results;
    } catch (err) {
      console.error('Error al cargar carritos abandonados:', err);
      return [];
    }
  },

  /**
   * Permite al admin descartar o vaciar el carrito abandonado de un usuario
   */
  async adminClearCart(userId: string): Promise<boolean> {
    return this.clearUserCart(userId);
  }
};
