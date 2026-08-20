import { supabase } from './supabaseClient';

export interface RefundRequest {
  id?: string;
  orderNumero: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  motivo: string;
  detalle?: string;
  cbuReintegro?: string;
  aliasReintegro?: string;
  estado?: 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado' | 'reembolsado';
  resolucionNotas?: string;
  createdAt?: string;
}

export const refundService = {
  /**
   * Crea una nueva solicitud de arrepentimiento o reembolso
   */
  create: async (req: RefundRequest): Promise<{ success: boolean; id?: string; error?: string }> => {
    try {
      const generatedId = `REF-${Date.now().toString().slice(-6)}`;
      const { data, error } = await supabase
        .from('refund_requests')
        .insert({
          id: generatedId,
          order_numero: req.orderNumero,
          customer_name: req.customerName,
          customer_email: req.customerEmail || '',
          customer_phone: req.customerPhone,
          motivo: req.motivo,
          detalle: req.detalle || '',
          cbu_reintegro: req.cbuReintegro || '',
          alias_reintegro: req.aliasReintegro || '',
          estado: 'pendiente',
        })
        .select()
        .single();

      if (error) {
        console.error('Error guardando solicitud de reembolso en Supabase:', error);
        return { success: false, error: error.message };
      }

      return { success: true, id: data.id };
    } catch (e: any) {
      console.error('Exception creating refund request:', e);
      return { success: false, error: e?.message || 'Error inesperado al registrar la solicitud.' };
    }
  },

  /**
   * Lista todas las solicitudes de reembolso para el admin
   */
  getAll: async (): Promise<RefundRequest[]> => {
    try {
      const { data, error } = await supabase
        .from('refund_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((d: any) => ({
        id: d.id,
        orderNumero: d.order_numero,
        customerName: d.customer_name,
        customerEmail: d.customer_email,
        customerPhone: d.customer_phone,
        motivo: d.motivo,
        detalle: d.detalle,
        cbuReintegro: d.cbu_reintegro,
        aliasReintegro: d.alias_reintegro,
        estado: d.estado,
        resolucionNotas: d.resolucion_notas,
        createdAt: d.created_at,
      }));
    } catch (e) {
      console.error('Error fetching refund requests:', e);
      return [];
    }
  }
};
