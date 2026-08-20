import { supabase } from './supabaseClient';
import { PaymentLog, PaymentMethod, PaymentMethodConfig, PaymentStatus } from '../types/payment';

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

const DEFAULT_PAYMENT_CONFIGS: PaymentMethodConfig[] = [
  {
    id: 'efectivo',
    nombre: 'Contra entrega / Efectivo',
    descripcion: 'Abonás en efectivo cuando recibís tu pedido',
    activo: true,
    disponibleMinorista: true,
    disponibleMayorista: true,
    disponibleSucursal: true,
    orden: 1,
  },
  {
    id: 'mercadopago',
    nombre: 'Mercado Pago (Tarjeta o dinero en cuenta)',
    descripcion: 'Dinero en cuenta, débito o crédito',
    activo: true,
    disponibleMinorista: true,
    disponibleMayorista: true,
    disponibleSucursal: true,
    orden: 2,
  },
  {
    id: 'transferencia',
    nombre: 'Transferencia Bancaria',
    descripcion: 'Mostrar datos bancarios al confirmar',
    activo: true,
    disponibleMinorista: true,
    disponibleMayorista: true,
    disponibleSucursal: true,
    orden: 3,
  },
  {
    id: 'pago_a_acordar',
    nombre: 'Pago a acordar',
    descripcion: 'Coordinar condiciones de pago con el vendedor / administración',
    activo: true,
    disponibleMinorista: true,
    disponibleMayorista: true,
    disponibleSucursal: true,
    orden: 4,
  },
  {
    id: 'cuenta_corriente',
    nombre: 'Cuenta Corriente',
    descripcion: 'Facturación diferida a cuenta corriente',
    activo: true,
    disponibleMinorista: false,
    disponibleMayorista: true,
    disponibleSucursal: true,
    orden: 5,
  },
];

const mapPaymentConfig = (d: any): PaymentMethodConfig => ({
  id: d.id,
  nombre: d.nombre,
  descripcion: d.descripcion || undefined,
  activo: d.activo ?? true,
  disponibleMinorista: d.disponible_minorista ?? true,
  disponibleMayorista: d.disponible_mayorista ?? true,
  disponibleSucursal: d.disponible_sucursal ?? true,
  orden: d.orden ?? 0,
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
  },

  /**
   * Obtiene la configuración de todos los medios de pago
   */
  getConfigs: async (): Promise<PaymentMethodConfig[]> => {
    try {
      const { data, error } = await supabase
        .from('payment_method_settings')
        .select('*')
        .order('orden', { ascending: true });

      if (error || !data || data.length === 0) {
        return DEFAULT_PAYMENT_CONFIGS;
      }
      return data.map(mapPaymentConfig);
    } catch (e) {
      console.warn('Usando configuración de medios de pago por defecto:', e);
      return DEFAULT_PAYMENT_CONFIGS;
    }
  },

  /**
   * Actualiza o crea la configuración de un medio de pago
   */
  updateConfig: async (config: PaymentMethodConfig): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('payment_method_settings')
        .upsert({
          id: config.id,
          nombre: config.nombre,
          descripcion: config.descripcion,
          activo: config.activo,
          disponible_minorista: config.disponibleMinorista,
          disponible_mayorista: config.disponibleMayorista,
          disponible_sucursal: config.disponibleSucursal,
          orden: config.orden,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error guardando configuración de medio de pago:', e);
      return false;
    }
  },

  /**
   * Guarda lote completo de configuraciones de medios de pago
   */
  saveAllConfigs: async (configs: PaymentMethodConfig[]): Promise<boolean> => {
    try {
      const payload = configs.map(c => ({
        id: c.id,
        nombre: c.nombre,
        descripcion: c.descripcion,
        activo: c.activo,
        disponible_minorista: c.disponibleMinorista,
        disponible_mayorista: c.disponibleMayorista,
        disponible_sucursal: c.disponibleSucursal,
        orden: c.orden,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('payment_method_settings')
        .upsert(payload);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error guardando configuraciones de medios de pago:', e);
      return false;
    }
  }
};
