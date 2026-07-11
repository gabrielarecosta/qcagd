import { supabase } from './supabaseClient';
import { PaymentLog, PaymentMethod, PaymentStatus } from '../types/payment';

const mapPaymentLog = (d: any): PaymentLog => ({
  id: d.id,
  orderId: d.order_id,
  branchId: d.branch_id,
  fecha: d.fecha,
  monto: Number(d.monto),
  metodo: d.metodo as PaymentMethod,
  estado: d.estado as PaymentStatus,
  referenciaMock: d.referencia_mock || undefined,
});

export const paymentService = {
  getAll: async (branchId?: string): Promise<PaymentLog[]> => {
    let query = supabase.from('payment_logs').select('*');
    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }
    const { data, error } = await query.order('fecha', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapPaymentLog);
  },

  create: async (log: Omit<PaymentLog, 'id'>): Promise<PaymentLog> => {
    const paymentId = `pay-${Date.now()}`;
    const dbInsert = {
      id: paymentId,
      order_id: log.orderId,
      branch_id: log.branchId,
      fecha: log.fecha || new Date().toISOString(),
      monto: log.monto,
      metodo: log.metodo,
      estado: log.estado,
      referencia_mock: log.referenciaMock,
    };

    const { data, error } = await supabase
      .from('payment_logs')
      .insert(dbInsert)
      .select('*')
      .single();

    if (error) throw error;

    // Actualizar también el estado de pago de la orden
    await supabase
      .from('orders')
      .update({ payment_status: log.estado, updated_at: new Date().toISOString() })
      .eq('id', log.orderId);

    return mapPaymentLog(data);
  },

  updateStatus: async (id: string, status: PaymentStatus): Promise<PaymentLog> => {
    const { data, error } = await supabase
      .from('payment_logs')
      .update({ estado: status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    // Actualizar también el estado de pago de la orden
    await supabase
      .from('orders')
      .update({ payment_status: status, updated_at: new Date().toISOString() })
      .eq('id', data.order_id);

    return mapPaymentLog(data);
  }
};
