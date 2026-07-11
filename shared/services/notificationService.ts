import { supabase } from './supabaseClient';
import { InternalNotification, NotificationType } from '../types/notification';

const mapNotification = (d: any): InternalNotification => ({
  id: d.id,
  branchId: d.branch_id || undefined,
  titulo: d.titulo,
  mensaje: d.mensaje,
  tipo: d.tipo as NotificationType,
  leido: d.leido,
  referenciaId: d.referencia_id || undefined,
  fecha: d.fecha,
});

export const notificationService = {
  getAll: async (branchId?: string): Promise<InternalNotification[]> => {
    let query = supabase.from('notifications').select('*');
    if (branchId && branchId !== 'all') {
      query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
    }
    const { data, error } = await query.order('fecha', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapNotification);
  },

  create: async (notif: Omit<InternalNotification, 'id' | 'fecha' | 'leido'>): Promise<InternalNotification> => {
    const notifId = `notif-${Date.now()}`;
    const dbInsert = {
      id: notifId,
      branch_id: notif.branchId,
      titulo: notif.titulo,
      mensaje: notif.mensaje,
      tipo: notif.tipo,
      leido: false,
      referencia_id: notif.referenciaId,
      fecha: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert(dbInsert)
      .select('*')
      .single();

    if (error) throw error;
    return mapNotification(data);
  },

  markAsRead: async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('notifications')
      .update({ leido: true })
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  markAllAsRead: async (branchId?: string): Promise<void> => {
    let query = supabase.from('notifications').update({ leido: true });
    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    } else {
      query = query.is('branch_id', null);
    }
    const { error } = await query;
    if (error) throw error;
  }
};
