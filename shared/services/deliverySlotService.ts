import { supabase } from './supabaseClient';

export interface DeliverySlot {
  id: string;
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  max_pedidos: number | null;
  activo: boolean;
}

export const deliverySlotService = {
  /**
   * Obtiene todas las franjas horarias configuradas en la base de datos
   */
  getAll: async (): Promise<DeliverySlot[]> => {
    const { data, error } = await supabase
      .from('delivery_time_slots')
      .select('*')
      .order('hora_inicio', { ascending: true });
      
    if (error) {
      console.warn('⚠️ No se pudieron obtener franjas horarias (¿tabla delivery_time_slots no migrada?):', error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Obtiene una franja horaria por ID
   */
  getById: async (id: string): Promise<DeliverySlot> => {
    const { data, error } = await supabase
      .from('delivery_time_slots')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Crea una nueva franja horaria
   */
  create: async (slot: Omit<DeliverySlot, 'id'>): Promise<DeliverySlot> => {
    const id = `slot-${Date.now()}`;
    const { data, error } = await supabase
      .from('delivery_time_slots')
      .insert({ id, ...slot })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Actualiza una franja horaria existente
   */
  update: async (id: string, updates: Partial<DeliverySlot>): Promise<DeliverySlot> => {
    const { data, error } = await supabase
      .from('delivery_time_slots')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Elimina una franja horaria
   */
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('delivery_time_slots')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Obtiene la cantidad de pedidos agendados para una fecha y franja horaria específicas
   */
  getSlotOrderCount: async (slotId: string, date: string): Promise<number> => {
    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('delivery_time_slot_id', slotId)
      .eq('delivery_date', date)
      .is('deleted_at', null)
      .not('estado', 'eq', 'cancelado');
      
    if (error) {
      console.error('Error counting orders for slot:', error);
      return 0;
    }
    return count || 0;
  },
};
