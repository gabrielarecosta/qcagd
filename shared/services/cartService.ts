import { supabase } from './supabaseClient';

export interface CartItemPayload {
  producto: any;
  cantidad: number;
  shadowCopy?: boolean;
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
};
