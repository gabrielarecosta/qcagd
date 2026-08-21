import { supabase } from './supabaseClient';
import { KPIReport, GeneralReports } from '../types/report';

export const reportService = {
  getKPIs: async (branchId?: string): Promise<KPIReport> => {
    // 1. Fetch orders from Supabase
    let query = supabase.from('orders').select('*').is('deleted_at', null);
    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }
    const { data: orders, error: ordersErr } = await query;
    if (ordersErr) throw ordersErr;

    const todayStr = new Date().toDateString();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    let ventasDia = 0;
    let ventasSemana = 0;
    let pendingPreps = 0;
    let pendingRepartos = 0;
    let delivering = 0;
    let delivered = 0;
    let pendingPayments = 0;
    let cashOrders = 0;
    let mpOrders = 0;

    (orders || []).forEach(o => {
      const orderDate = new Date(o.fecha);
      const isToday = orderDate.toDateString() === todayStr;
      const isThisWeek = orderDate >= oneWeekAgo;

      if (o.estado === 'entregado' && isToday) ventasDia += Number(o.total);
      if (o.estado === 'entregado' && isThisWeek) ventasSemana += Number(o.total);

      if (o.estado === 'recibido' || o.estado === 'en_preparacion') pendingPreps++;
      if (o.estado === 'listo_para_reparto') pendingRepartos++;
      if (o.estado === 'en_reparto') delivering++;
      if (o.estado === 'entregado') delivered++;

      if (o.payment_status !== 'pagado' && o.payment_status !== 'aprobado' && o.estado !== 'cancelado') {
        pendingPayments += Number(o.total);
      }

      if (o.payment_method === 'efectivo') cashOrders++;
      if (o.payment_method === 'mercado_pago') mpOrders++;
    });

    // 2. Fetch inventory/low stock
    const targetBranch = branchId && branchId !== 'all' ? branchId : 1;
    const { data: lowStockData, error: lowStockErr } = await supabase
      .from('inventory')
      .select('count', { count: 'exact', head: true })
      .eq('branch_id', targetBranch)
      .filter('stock', 'lte', 'stock_minimo');

    if (lowStockErr) throw lowStockErr;
    const lowStockCount = lowStockData ? 0 : 0; // fallback, count: exact is better, let's select actually
    const { data: stocks } = await supabase
      .from('inventory')
      .select('id')
      .eq('branch_id', targetBranch)
      .filter('stock', 'lte', 'stock_minimo');
    const actualLowStockCount = stocks ? stocks.length : 0;

    // 3. Fetch active delivery routes
    let delivQuery = supabase.from('delivery_routes').select('*').neq('estado', 'entregado');
    if (branchId && branchId !== 'all') {
      delivQuery = delivQuery.eq('branch_id', branchId);
    }
    const { data: delivs } = await delivQuery;
    const scheduledRoutesCount = delivs ? delivs.length : 0;

    // 4. Clientes activos
    let clientQuery = supabase.from('customers').select('id').eq('activo', true).is('deleted_at', null);
    if (branchId && branchId !== 'all') {
      clientQuery = clientQuery.eq('branch_id', branchId);
    }
    const { data: clients } = await clientQuery;
    const activeClientsCount = clients ? clients.length : 0;

    return {
      ventasDia,
      ventasSemana,
      pedidosPendientes: pendingPreps,
      pedidosEnPreparacion: pendingPreps,
      pedidosEnReparto: delivering,
      pedidosEntregados: delivered,
      pagosPendientes: pendingPayments,
      pedidosEfectivo: cashOrders,
      pedidosMercadoPago: mpOrders,
      clientesActivos: activeClientsCount,
      bajoStockCount: actualLowStockCount,
      repartosProgramados: scheduledRoutesCount,
    };
  },

  getGeneralReports: async (branchId?: string): Promise<GeneralReports> => {
    // 1. Fetch orders with customer details
    let query = supabase
      .from('orders')
      .select('*, customers(nombre)')
      .is('deleted_at', null);

    if (branchId && branchId !== 'all') {
      query = query.eq('branch_id', branchId);
    }
    const { data: orders, error: orderErr } = await query;
    if (orderErr) throw orderErr;

    // 2. Fetch order items for calculations
    const orderIds = (orders || []).map(o => o.id);
    let items: any[] = [];
    if (orderIds.length > 0) {
      const { data: itemsData, error: itemsErr } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);
      if (itemsErr) throw itemsErr;
      items = itemsData || [];
    }

    const ventasPorDiaMap: Record<string, number> = {};
    const pagosMap: Record<string, number> = {};
    const estadosMap: Record<string, number> = {};
    const productSalesMap: Record<string, { nombre: string; qty: number; total: number }> = {};
    const clientSalesMap: Record<string, { nombre: string; count: number; total: number }> = {};

    (orders || []).forEach(o => {
      const dateLabel = new Date(o.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
      
      if (o.estado === 'entregado') {
        ventasPorDiaMap[dateLabel] = (ventasPorDiaMap[dateLabel] ?? 0) + Number(o.total);
      }

      pagosMap[o.payment_method] = (pagosMap[o.payment_method] ?? 0) + 1;
      estadosMap[o.estado] = (estadosMap[o.estado] ?? 0) + 1;

      // Filter items for this order
      const oItems = items.filter(item => item.order_id === o.id);
      oItems.forEach(i => {
        const prodId = i.product_id;
        if (!productSalesMap[prodId]) {
          productSalesMap[prodId] = { nombre: i.nombre, qty: 0, total: 0 };
        }
        productSalesMap[prodId].qty += Number(i.cantidad);
        productSalesMap[prodId].total += Number(i.subtotal);
      });

      // Customer name
      const cName = o.customers ? o.customers.nombre : 'Cliente Eliminado';
      if (!clientSalesMap[o.cliente_id]) {
        clientSalesMap[o.cliente_id] = { nombre: cName, count: 0, total: 0 };
      }
      clientSalesMap[o.cliente_id].count += 1;
      clientSalesMap[o.cliente_id].total += Number(o.total);
    });

    const ventasPorDia = Object.entries(ventasPorDiaMap)
      .map(([label, value]) => ({ label, value }))
      .reverse()
      .slice(0, 7);
    const pagosMasUsados = Object.entries(pagosMap).map(([label, value]) => ({ label, value }));
    const pedidosPorEstado = Object.entries(estadosMap).map(([label, value]) => ({ label, value }));

    const productosMasVendidos = Object.entries(productSalesMap)
      .map(([id, val]) => ({ id, nombre: val.nombre, cantidad: val.qty, total: val.total }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    const clientesMasActivos = Object.entries(clientSalesMap)
      .map(([id, val]) => ({ id, nombre: val.nombre, pedidosCount: val.count, totalGastado: val.total }))
      .sort((a, b) => b.totalGastado - a.totalGastado)
      .slice(0, 5);

    // Sales by branch
    const branchSalesMap: Record<string, number> = {};
    const { data: branches } = await supabase.from('branches').select('id, nombre');
    const branchNames: Record<string, string> = {};
    (branches || []).forEach(b => {
      branchNames[b.id] = b.nombre;
    });

    (orders || []).forEach(o => {
      if (o.estado === 'entregado') {
        const bName = branchNames[o.branch_id] || 'General Deheza 1';
        branchSalesMap[bName] = (branchSalesMap[bName] ?? 0) + Number(o.total);
      }
    });
    const ventasPorSucursal = Object.entries(branchSalesMap).map(([label, value]) => ({ label, value }));

    return {
      ventasPorDia,
      ventasPorSemana: [], // reuse dia
      pedidosPorEstado,
      productosMasVendidos,
      clientesMasActivos,
      zonasMasEntregas: [],
      pagosMasUsados,
      ventasPorSucursal,
    };
  }
};
