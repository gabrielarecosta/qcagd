import { supabase } from './supabaseClient';

export interface DeliverySlot {
  id: number | string;
  nombre: string;
  hora_inicio: string;
  hora_fin: string;
  max_pedidos: number | null;
  capacidad_maxima?: number | null;
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
  getById: async (id: string | number): Promise<DeliverySlot> => {
    const numId = typeof id === 'number' ? id : (isNaN(Number(id)) ? id : Number(id));
    const { data, error } = await supabase
      .from('delivery_time_slots')
      .select('*')
      .eq('id', numId)
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Crea una nueva franja horaria
   */
  create: async (slot: Omit<DeliverySlot, 'id'>): Promise<DeliverySlot> => {
    const { data, error } = await supabase
      .from('delivery_time_slots')
      .insert(slot)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Actualiza una franja horaria existente
   */
  update: async (id: string | number, updates: Partial<DeliverySlot>): Promise<DeliverySlot> => {
    const numId = typeof id === 'number' ? id : (isNaN(Number(id)) ? id : Number(id));
    const { data, error } = await supabase
      .from('delivery_time_slots')
      .update(updates)
      .eq('id', numId)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Elimina una franja horaria
   */
  delete: async (id: string | number): Promise<void> => {
    const numId = typeof id === 'number' ? id : (isNaN(Number(id)) ? id : Number(id));
    const { error } = await supabase
      .from('delivery_time_slots')
      .delete()
      .eq('id', numId);
    if (error) throw error;
  },

  /**
   * Obtiene la cantidad de pedidos agendados para una fecha y franja horaria específicas
   */
  getSlotOrderCount: async (slotId: string | number, date: string): Promise<number> => {
    try {
      const numId = typeof slotId === 'number' ? slotId : Number(slotId);
      if (isNaN(numId)) {
        return 0;
      }
      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_time_slot_id', numId)
        .eq('delivery_date', date)
        .is('deleted_at', null)
        .not('estado', 'eq', 'cancelado');
        
      if (error) {
        return 0;
      }
      return count || 0;
    } catch {
      return 0;
    }
  },
};
