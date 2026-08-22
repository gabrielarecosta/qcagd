import React, { useState, useMemo, useEffect } from 'react';
import { useAdminStore } from '../store/adminStore';
import { formatPrice } from '@shared/utils/formatCurrency';
import { getBranchName } from '@shared/utils/branchUtils';
import { ORDER_STATUS_LABELS } from '@shared/utils/orderStatusUtils';
import { OrderStatus } from '@shared/types';
import { supabase } from '@shared/services/supabaseClient';

interface DashboardViewProps {
  onNavigate?: (tab: any) => void;
  onFilterProductsNoPhoto?: () => void;
}

export function DashboardView({ onNavigate, onFilterProductsNoPhoto }: DashboardViewProps) {
  const { 
    activeBranchId, 
    orders, 
    stocks, 
    products, 
    deliveries, 
    clients, 
    updateOrderStatus,
    fetchOrdersOnly,
    fetchClientsOnly,
    fetchDeliveriesOnly,
    fetchProductsOnly
  } = useAdminStore();

  const [latestImport, setLatestImport] = useState<any | null>(null);

  const loadLatestImport = async () => {
    try {
      const { data, error } = await supabase
        .from('imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setLatestImport(data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchOrdersOnly();
    fetchClientsOnly();
    fetchDeliveriesOnly();
    fetchProductsOnly();
    loadLatestImport();

    // Suscripción Realtime a Supabase para actualización automática
    const channel = supabase
      .channel('realtime-dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrdersOnly();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'imports' }, () => {
        loadLatestImport();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchProductsOnly();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchProductsOnly();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => {
        fetchClientsOnly();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_routes' }, () => {
        fetchDeliveriesOnly();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [dateFilter, setDateFilter] = useState<'hoy' | 'ayer' | '7dias' | 'mes' | 'personalizado'>('7dias');
  const [openActionDropdownOrderId, setOpenActionDropdownOrderId] = useState<string | number | null>(null);
  const [hoveredBar, setHoveredBar] = useState<{ x: number; y: number; label: string; amount: number } | null>(null);

  // Fecha de referencia actual (tiempo real de Supabase)
  const baseToday = useMemo(() => new Date(), []);

  // 1. Filtrado de órdenes por fecha y sucursal
  const filteredOrders = useMemo(() => {
    let list = orders;
    if (activeBranchId !== 'all') {
      list = list.filter(o => o.branchId === activeBranchId);
    }

    const today = new Date(baseToday.getFullYear(), baseToday.getMonth(), baseToday.getDate());

    return list.filter(o => {
      const oDate = new Date(o.fecha);
      const oDay = new Date(oDate.getFullYear(), oDate.getMonth(), oDate.getDate());

      switch (dateFilter) {
        case 'hoy':
          return oDay.getTime() === today.getTime();
        case 'ayer': {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          return oDay.getTime() === yesterday.getTime();
        }
        case '7dias': {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return oDate >= sevenDaysAgo && oDate <= baseToday;
        }
        case 'mes': {
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          return oDate >= monthStart && oDate <= baseToday;
        }
        case 'personalizado':
        default:
          return true;
      }
    });
  }, [orders, activeBranchId, dateFilter, baseToday]);

  // 2. Cálculos financieros y operativos en caliente (KPIs)
  const kpis = useMemo(() => {
    let ventasPeriodo = 0;
    let pagosPendientes = 0;
    let pendientesCount = 0;
    let enRepartoCount = 0;

    // Métricas del período filtrado
    filteredOrders.forEach(o => {
      if (o.estado === 'entregado') {
        ventasPeriodo += o.total;
      }
      if (o.paymentStatus !== 'pagado' && o.paymentStatus !== 'aprobado' && o.estado !== 'cancelado') {
        pagosPendientes += o.total;
      }
      if (o.estado === 'recibido' || o.estado === 'en_preparacion') {
        pendientesCount++;
      }
      if (o.estado === 'en_reparto') {
        enRepartoCount++;
      }
    });

    // Ventas semanales totales (independiente de filtros rápidos de fecha para comparar tendencia)
    const sevenDaysAgo = new Date(baseToday);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const ventasSemana = orders
      .filter(o => {
        const isBranch = activeBranchId === 'all' || o.branchId === activeBranchId;
        const oDate = new Date(o.fecha);
        return isBranch && o.estado === 'entregado' && oDate >= sevenDaysAgo && oDate <= baseToday;
      })
      .reduce((acc, curr) => acc + curr.total, 0);

    const activeClientsCount = clients.filter(
      c => c.activo && (activeBranchId === 'all' || c.branchId === activeBranchId)
    ).length;

    const targetBranch = activeBranchId === 'all' ? 1 : activeBranchId;
    const lowStockCount = stocks.filter(
      s => String(s.branchId) === String(targetBranch) && s.stock <= s.stockMinimo
    ).length;

    const activeDeliveriesCount = deliveries.filter(
      d => (activeBranchId === 'all' || d.branchId === activeBranchId) && d.estado !== 'entregado'
    ).length;

    return {
      ventasPeriodo,
      ventasSemana,
      pagosPendientes,
      clientesActivos: activeClientsCount,
      pedidosPendientes: pendientesCount,
      pedidosEnReparto: enRepartoCount,
      repartosHoy: activeDeliveriesCount,
      bajoStockCount: lowStockCount
    };
  }, [filteredOrders, orders, stocks, deliveries, clients, activeBranchId, baseToday]);

  // 3. Alertas de lo que requiere atención hoy (Feed Dinámico)
  const alertsFeed = useMemo(() => {
    const list = [];
    const targetBranch = activeBranchId === 'all' ? undefined : activeBranchId;

    // Alerta 1: Pedidos recibidos sin preparar
    const recibidos = orders.filter(o => (!targetBranch || o.branchId === targetBranch) && o.estado === 'recibido');
    if (recibidos.length > 0) {
      list.push({
        id: 'pending-prep',
        type: 'yellow',
        text: `${recibidos.length} Pedido(s) recibidos sin preparar`,
        sub: 'Pendiente procesamiento en depósito.'
      });
    }

    // Alerta 2: Pedidos listos para reparto sin repartidor/hoja de ruta
    const listosSinRepartidor = orders.filter(o => (!targetBranch || o.branchId === targetBranch) && o.estado === 'listo_para_reparto' && !o.repartidorId);
    if (listosSinRepartidor.length > 0) {
      list.push({
        id: 'ready-no-route',
        type: 'blue',
        text: `${listosSinRepartidor.length} Pedido(s) listos sin asignar`,
        sub: 'Requieren asignación a planilla de reparto.'
      });
    }

    // Alerta 3: Repartos activos
    const enReparto = orders.filter(o => (!targetBranch || o.branchId === targetBranch) && o.estado === 'en_reparto');
    if (enReparto.length > 0) {
      list.push({
        id: 'delivering-active',
        type: 'purple',
        text: `${enReparto.length} Reparto(s) en curso hoy`,
        sub: 'Planilla activa en calle.'
      });
    }

    // Alerta 4: Stock crítico
    const branchStockKey = activeBranchId === 'all' ? 1 : activeBranchId;
    const criticalStock = stocks.filter(s => String(s.branchId) === String(branchStockKey) && s.stock <= s.stockMinimo);
    if (criticalStock.length > 0) {
      list.push({
        id: 'critical-stock-alert',
        type: 'red',
        text: `${criticalStock.length} Artículos bajo stock mínimo`,
        sub: 'Stock en bodega requiere reposición.'
      });
    }

    // Alerta 5: Pagos pendientes de cobro
    const pagosPendientesCount = orders.filter(
      o => (!targetBranch || o.branchId === targetBranch) && o.paymentStatus !== 'pagado' && o.paymentStatus !== 'aprobado' && o.estado !== 'cancelado'
    ).length;
    if (pagosPendientesCount > 0) {
      list.push({
        id: 'unpaid-alert',
        type: 'orange',
        text: `${pagosPendientesCount} Pedidos pendientes de cobro`,
        sub: 'Validar pagos en cuenta o efectivo al entregar.'
      });
    }

    // Alerta 6: Productos sin precio fijado en catálogo
    const freeProds = products.filter(p => p.precio === 0 || !p.precio);
    if (freeProds.length > 0) {
      list.push({
        id: 'free-products-alert',
        type: 'cyan',
        text: `${freeProds.length} Artículo(s) con precio en cero`,
        sub: 'Catálogo de ventas requiere revisión.'
      });
    }

    // Alerta 7: Productos sin foto en catálogo
    const noPhotoProds = products.filter(p => !p.imagen || p.imagen.trim() === '');
    if (noPhotoProds.length > 0) {
      list.push({
        id: 'no-photo-products-alert',
        type: 'pink',
        text: `${noPhotoProds.length} Artículo(s) sin foto en el catálogo`,
        sub: 'Click para ver y cargar imágenes en Catálogo.'
      });
    }

    return list.slice(0, 8); // Límite de 8 alertas principales
  }, [orders, stocks, products, activeBranchId]);

  // 4. Tabla de Pedidos Recientes (últimos 6 pedidos)
  const recentOrders = useMemo(() => {
    return filteredOrders.slice(0, 6);
  }, [filteredOrders]);

  // 5. Datos Bajo Stock Detallados (Top 4 crítico)
  const detailedLowStock = useMemo(() => {
    const branchId = activeBranchId === 'all' ? 1 : activeBranchId;
    return stocks
      .filter(s => String(s.branchId) === String(branchId) && s.stock <= s.stockMinimo)
      .slice(0, 4)
      .map(s => {
        const prod = products.find(p => p.id === s.productId);
        const name = prod ? prod.nombre : 'Producto Desconocido';
        const percent = s.stockMinimo > 0 ? Math.min((s.stock / s.stockMinimo) * 100, 100) : 0;
        return {
          id: s.productId,
          nombre: name,
          stock: s.stock,
          minimo: s.stockMinimo,
          percent
        };
      });
  }, [activeBranchId, stocks, products]);

  // 6. Gráfico de Ventas de los últimos 7 días (SVG)
  const last7DaysSales = useMemo(() => {
    const data: { label: string; dateStr: string; amount: number }[] = [];
    const tempDate = new Date(baseToday);

    for (let i = 6; i >= 0; i--) {
      const d = new Date(tempDate);
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
      const dateStr = d.toDateString();

      const amount = orders
        .filter(o => {
          const isBranch = activeBranchId === 'all' || o.branchId === activeBranchId;
          const oDate = new Date(o.fecha);
          return isBranch && oDate.toDateString() === dateStr && o.estado === 'entregado';
        })
        .reduce((sum, curr) => sum + curr.total, 0);

      data.push({ label, dateStr, amount });
    }
    return data;
  }, [orders, activeBranchId, baseToday]);

  const maxSaleAmount = useMemo(() => {
    const max = Math.max(...last7DaysSales.map(d => d.amount));
    return max > 0 ? max : 1000;
  }, [last7DaysSales]);

  // 7. Gráfico Donut de Estados (SVG)
  const statusDonutData = useMemo(() => {
    const counts: Record<string, number> = {
      recibido: 0,
      en_preparacion: 0,
      listo_para_reparto: 0,
      en_reparto: 0,
      entregado: 0,
      cancelado: 0
    };
    let total = 0;

    orders.forEach(o => {
      if (activeBranchId === 'all' || o.branchId === activeBranchId) {
        counts[o.estado] = (counts[o.estado] ?? 0) + 1;
        total++;
      }
    });

    const colors: Record<string, string> = {
      recibido: '#f59e0b',
      en_preparacion: '#06b6d4',
      listo_para_reparto: '#3b82f6',
      en_reparto: '#8b5cf6',
      entregado: '#10b981',
      cancelado: '#ef4444'
    };

    let cumulativeAngle = 0;
    const slices = Object.entries(counts).map(([status, count]) => {
      const pct = total > 0 ? count / total : 0;
      const angle = pct * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;

      return {
        status,
        count,
        pct,
        startAngle,
        endAngle,
        color: colors[status] || '#64748b'
      };
    }).filter(s => s.count > 0);

    return { slices, total };
  }, [orders, activeBranchId]);

  // 8. Gráfico de barras horizontal: Productos más vendidos (Top 5)
  const topSoldProducts = useMemo(() => {
    const map: Record<string, { nombre: string; qty: number }> = {};
    orders.forEach(o => {
      if ((activeBranchId === 'all' || o.branchId === activeBranchId) && o.estado === 'entregado') {
        o.items.forEach(item => {
          const id = item.producto.id;
          if (!map[id]) {
            map[id] = { nombre: item.producto.nombre, qty: 0 };
          }
          map[id].qty += item.cantidad;
        });
      }
    });

    const sorted = Object.entries(map)
      .map(([id, val]) => ({ id, ...val }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const maxQty = sorted.length > 0 ? Math.max(...sorted.map(s => s.qty)) : 1;
    return sorted.map(s => ({
      ...s,
      percent: (s.qty / maxQty) * 100
    }));
  }, [orders, activeBranchId]);

  // Helpers para dibujar la dona de estados
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", start.x, start.y, 
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  };

  const handleUpdateStatus = (orderId: string | number, status: any) => {
    updateOrderStatus(orderId, status);
    setOpenActionDropdownOrderId(null);
  };

  return (
    <div>
      {/* Sección Superior: Título y Controles */}
      <div className="flex align-center justify-between" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Dashboard General</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            Resumen operativo y financiero para {getBranchName(activeBranchId === 'all' ? undefined : activeBranchId)}
          </p>
        </div>

        {/* Controles de fecha */}
        <div className="dashboard-header-controls">
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            📅 Período:
          </span>
          <div className="date-filters-container">
            {(['hoy', 'ayer', '7dias', 'mes', 'personalizado'] as const).map(filter => (
              <button
                key={filter}
                className={`date-filter-btn ${dateFilter === filter ? 'active' : ''}`}
                onClick={() => setDateFilter(filter)}
              >
                {filter === 'hoy' ? 'Hoy' : 
                 filter === 'ayer' ? 'Ayer' : 
                 filter === '7dias' ? '7 Días' : 
                 filter === 'mes' ? 'Mes' : 'Histórico'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Acciones Rápidas */}
      <div className="quick-actions-row">
        <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-disabled)', marginRight: '8px', letterSpacing: '0.5px' }}>
          Acciones Rápidas:
        </span>
        <button className="quick-action-btn" onClick={() => onNavigate?.('orders')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo Pedido
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate?.('excel')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Importar Precios
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate?.('products')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          Actualizar Stock
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate?.('payments')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
          Pagos Pendientes
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate?.('deliveries')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
            <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
          Hoja de Ruta
        </button>
      </div>

      {/* Sección 2: KPIs (9 tarjetas premium interactivas) */}
      <div className="kpis-grid-premium">
        {/* Último Excel Subido */}
        <div 
          className="kpi-card-premium"
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          onClick={() => onNavigate?.('excel')}
          title="Ver Historial de Importaciones Excel"
        >
          <div className="kpi-card-details">
            <span className="kpi-title" style={{ color: '#10b981' }}>📊 Último Excel Subido</span>
            <span className="kpi-value-premium" style={{ fontSize: '15px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
              {latestImport ? (latestImport.nombre_archivo || 'Importación activa') : 'Sin historial'}
            </span>
            <span className="kpi-sub-trend">
              {latestImport && latestImport.created_at ? (
                <>📅 {new Date(latestImport.created_at).toLocaleDateString('es-AR')} {new Date(latestImport.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</>
              ) : (
                'Importar catálogo Excel'
              )}
            </span>
          </div>
          <div className="kpi-icon-container" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
        </div>

        {/* Ventas del Período */}
        <div 
          className="kpi-card-premium" 
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          onClick={() => onNavigate?.('orders')}
          title="Ver Pedidos y Ventas"
        >
          <div className="kpi-card-details">
            <span className="kpi-title">Ventas Período</span>
            <span className="kpi-value-premium">{formatPrice(kpis.ventasPeriodo)}</span>
            <span className="kpi-sub-trend">
              <span className="kpi-trend-up">↑ 12%</span> vs mes anterior
            </span>
          </div>
          <div className="kpi-icon-container" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success-color)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
        </div>

        {/* Ventas Semanales */}
        <div 
          className="kpi-card-premium"
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          onClick={() => onNavigate?.('orders')}
          title="Ver Tendencia de Pedidos"
        >
          <div className="kpi-card-details">
            <span className="kpi-title">Ventas Semanales</span>
            <span className="kpi-value-premium">{formatPrice(kpis.ventasSemana)}</span>
            <span className="kpi-sub-trend">Últimos 7 días acumulado</span>
          </div>
          <div className="kpi-icon-container" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 3v18h18"/><path d="m18.7 8-5.1 5.2-2.8-2.7L7 14.3"/>
            </svg>
          </div>
        </div>

        {/* Pagos a Cobrar */}
        <div 
          className="kpi-card-premium"
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          onClick={() => onNavigate?.('payments')}
          title="Ver Control de Pagos y Caja"
        >
          <div className="kpi-card-details">
            <span className="kpi-title">Pagos a Cobrar</span>
            <span className="kpi-value-premium">{formatPrice(kpis.pagosPendientes)}</span>
            <span className="kpi-sub-trend">Pedidos impagos activos</span>
          </div>
          <div className="kpi-icon-container" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning-color)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </div>
        </div>

        {/* Clientes Activos */}
        <div 
          className="kpi-card-premium"
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          onClick={() => onNavigate?.('clients')}
          title="Ver Directorio de Clientes"
        >
          <div className="kpi-card-details">
            <span className="kpi-title">Clientes Activos</span>
            <span className="kpi-value-premium">{kpis.clientesActivos}</span>
            <span className="kpi-sub-trend">Directorio en sucursal</span>
          </div>
          <div className="kpi-icon-container" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary-color)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
        </div>

        {/* Pedidos Pendientes */}
        <div 
          className="kpi-card-premium"
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          onClick={() => onNavigate?.('orders')}
          title="Ver Pedidos Pendientes de Armado"
        >
          <div className="kpi-card-details">
            <span className="kpi-title">Pendientes / Prep.</span>
            <span className="kpi-value-premium">{kpis.pedidosPendientes}</span>
            <span className="kpi-sub-trend">En cola de armado</span>
          </div>
          <div className="kpi-icon-container" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: '#0891b2' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
        </div>

        {/* En Reparto */}
        <div 
          className="kpi-card-premium"
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          onClick={() => onNavigate?.('orders')}
          title="Ver Pedidos en Reparto"
        >
          <div className="kpi-card-details">
            <span className="kpi-title">En Reparto</span>
            <span className="kpi-value-premium">{kpis.pedidosEnReparto}</span>
            <span className="kpi-sub-trend">Pedidos en calle</span>
          </div>
          <div className="kpi-icon-container" style={{ backgroundColor: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="5 17 12 12 5 7 5 17"/><polygon points="12 17 19 12 12 7 12 17"/>
            </svg>
          </div>
        </div>

        {/* Hojas de Ruta Activas */}
        <div 
          className="kpi-card-premium"
          style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
          onClick={() => onNavigate?.('deliveries')}
          title="Ver Logística y Hojas de Ruta"
        >
          <div className="kpi-card-details">
            <span className="kpi-title">Repartos de Hoy</span>
            <span className="kpi-value-premium">{kpis.repartosHoy}</span>
            <span className="kpi-sub-trend">Planillas de despacho</span>
          </div>
          <div className="kpi-icon-container" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#9333ea' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
        </div>

        {/* Bajo Stock Crítico */}
        <div 
          className="kpi-card-premium" 
          style={{ cursor: 'pointer', borderColor: kpis.bajoStockCount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)', transition: 'all 0.2s ease' }}
          onClick={() => onNavigate?.('products')}
          title="Ver Productos Bajo Stock Crítico"
        >
          <div className="kpi-card-details">
            <span className="kpi-title" style={{ color: kpis.bajoStockCount > 0 ? 'var(--error-color)' : 'var(--text-secondary)' }}>Bajo Stock Crítico</span>
            <span className="kpi-value-premium" style={{ color: kpis.bajoStockCount > 0 ? 'var(--error-color)' : 'var(--text-primary)' }}>{kpis.bajoStockCount}</span>
            <span className="kpi-sub-trend">Bajo el mínimo crítico</span>
          </div>
          <div className="kpi-icon-container" style={{ backgroundColor: 'var(--error-light)', color: 'var(--error-color)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Sección 3: Feed de Alertas "Qué requiere atención hoy" */}
      <div className="alerts-feed-wrapper">
        <div className="alerts-feed-title-section">
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--error-color)', animation: 'skeletonPulse 1.5s infinite' }} />
            Alertas Operativas Críticas
          </h3>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Monitoreo en tiempo real
          </span>
        </div>

        {alertsFeed.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--success-color)', fontSize: '13px', fontWeight: 'bold', border: '1px dashed rgba(16, 185, 129, 0.3)', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
            ✓ Operación impecable: no se registran alertas operativas hoy.
          </div>
        ) : (
          <div className="alerts-feed-grid">
            {alertsFeed.map(alert => (
              <div 
                key={alert.id} 
                className={`attention-alert-card alert-${alert.type}`}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (alert.id === 'no-photo-products-alert') {
                    onFilterProductsNoPhoto?.();
                  } else if (alert.id === 'free-products-alert') {
                    onNavigate?.('products');
                  } else if (alert.id === 'critical-stock-alert') {
                    onNavigate?.('products');
                  } else if (alert.id === 'pending-prep') {
                    onNavigate?.('orders');
                  } else if (alert.id === 'ready-no-route') {
                    onNavigate?.('deliveries');
                  } else {
                    onNavigate?.('products');
                  }
                }}
              >
                <div className="attention-alert-icon" style={{ 
                  backgroundColor: alert.type === 'yellow' ? 'var(--warning-light)' :
                                   alert.type === 'blue' ? 'var(--accent-light)' :
                                   alert.type === 'purple' ? 'rgba(139, 92, 246, 0.1)' :
                                   alert.type === 'red' ? 'var(--error-light)' :
                                   alert.type === 'orange' ? 'rgba(249, 115, 22, 0.1)' : 
                                   alert.type === 'pink' ? 'rgba(236, 72, 153, 0.1)' : 'rgba(6, 182, 212, 0.1)',
                  color: alert.type === 'yellow' ? 'var(--warning-color)' :
                         alert.type === 'blue' ? 'var(--accent-color)' :
                         alert.type === 'purple' ? '#7c3aed' :
                         alert.type === 'red' ? 'var(--error-color)' :
                         alert.type === 'orange' ? '#ea580c' : 
                         alert.type === 'pink' ? '#ec4899' : '#0891b2'
                }}>
                  {alert.type === 'red' ? '⚠️' : '🔔'}
                </div>
                <div className="attention-alert-content">
                  <h4 className="attention-alert-text">{alert.text}</h4>
                  <p className="attention-alert-sub">{alert.sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sección 4: Grid Principal (Pedidos Recientes & Detalle de Stock/Excel) */}
      <div className="dashboard-row">
        {/* Columna Izquierda: Pedidos Recientes */}
        <div className="card-wrapper" style={{ marginBottom: 0 }}>
          <div className="card-header" style={{ padding: '16px 24px' }}>
            <h2 className="card-title" style={{ fontSize: '16px' }}>Pedidos Recientes</h2>
            <button 
              className="btn btn-secondary" 
              onClick={() => onNavigate?.('orders')}
              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '9999px' }}
            >
              Ver todos
            </button>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentOrders.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-disabled)', fontSize: '13.5px' }}>
                No se registran pedidos en este período.
              </div>
            ) : (
              <div className="table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Cliente</th>
                      <th>Fecha</th>
                      <th>Total</th>
                      <th>Pago</th>
                      <th>Estado</th>
                      <th style={{ width: '40px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map(o => {
                      const client = clients.find(c => c.id === o.clienteId);
                      const clientName = client ? client.nombre : 'Cliente Desconocido';
                      const paymentLabel = o.paymentMethod === 'efectivo' ? 'Efectivo' : 
                                           o.paymentMethod === 'mercado_pago' ? 'M. Pago' : 
                                           o.paymentMethod === 'transferencia' ? 'Transf.' : 'Cta. Cte.';
                      
                      return (
                        <tr key={o.id}>
                          <td style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{o.numero}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>{clientName}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-disabled)' }}>{client?.tipoCliente === 'mayorista' ? 'Mayorista' : 'Minorista'}</span>
                            </div>
                          </td>
                          <td>{new Date(o.fecha).toLocaleDateString('es-AR')}</td>
                          <td style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{formatPrice(o.total)}</td>
                          <td>
                            <span className={`badge-premium ${
                              o.paymentStatus === 'pagado' || o.paymentStatus === 'aprobado'
                                ? 'badge-premium-entregado'
                                : o.paymentStatus === 'cuenta_corriente'
                                ? 'badge-premium-listo_para_reparto'
                                : 'badge-premium-pago_pendiente'
                            }`}>
                              {paymentLabel}
                            </span>
                          </td>
                          <td>
                            <span className={`badge-premium badge-premium-${o.estado}`}>
                              {ORDER_STATUS_LABELS[o.estado]}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="actions-cell-wrapper">
                              <button 
                                className="action-trigger-btn"
                                onClick={() => setOpenActionDropdownOrderId(openActionDropdownOrderId === o.id ? null : o.id)}
                              >
                                ✕
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: '1px' }}>
                                  <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
                                </svg>
                              </button>
                              
                              {openActionDropdownOrderId === o.id && (
                                <>
                                  {/* Overlay para cerrar dropdown */}
                                  <div 
                                    style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
                                    onClick={() => setOpenActionDropdownOrderId(null)}
                                  />
                                  <div className="actions-dropdown-menu">
                                    <button className="actions-dropdown-item" onClick={() => handleUpdateStatus(o.id, 'en_preparacion')}>
                                      ⚙️ Preparando
                                    </button>
                                    <button className="actions-dropdown-item" onClick={() => handleUpdateStatus(o.id, 'listo_para_reparto')}>
                                      📦 Listo para reparto
                                    </button>
                                    <button className="actions-dropdown-item" onClick={() => handleUpdateStatus(o.id, 'en_reparto')}>
                                      🚚 En reparto
                                    </button>
                                    <button className="actions-dropdown-item" onClick={() => handleUpdateStatus(o.id, 'entregado')}>
                                      ✓ Entregado (y pagado)
                                    </button>
                                    <button className="actions-dropdown-item item-danger" onClick={() => handleUpdateStatus(o.id, 'cancelado')}>
                                      ✕ Cancelar Pedido
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha: Tarjetas de Información Detallada */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Bajo Stock Detallado */}
          <div className="card-wrapper" style={{ marginBottom: 0 }}>
            <div className="card-header" style={{ padding: '16px 20px' }}>
              <h2 className="card-title" style={{ fontSize: '15px' }}>Stock Crítico</h2>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              {detailedLowStock.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--success-color)', fontWeight: 'bold', fontSize: '13px', padding: '12px' }}>
                  ✓ Stock completo en todas las líneas.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {detailedLowStock.map(item => (
                    <div key={item.id} className="stock-summary-card-item">
                      <div className="flex justify-between" style={{ marginBottom: '4px', fontSize: '12.5px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                          {item.nombre}
                        </span>
                        <span style={{ fontWeight: 700, color: item.stock === 0 ? 'var(--error-color)' : '#b45309' }}>
                          {item.stock} / {item.minimo} u
                        </span>
                      </div>
                      <div className="stock-detail-bar-container">
                        <div 
                          className="stock-detail-bar" 
                          style={{ 
                            width: `${item.percent}%`,
                            backgroundColor: item.stock === 0 ? 'var(--error-color)' : 'var(--warning-color)'
                          }} 
                        />
                      </div>
                    </div>
                  ))}

                  <button 
                    className="btn btn-secondary" 
                    onClick={() => onNavigate?.('products')}
                    style={{ width: '100%', fontSize: '12.5px', padding: '8px', marginTop: '4px' }}
                  >
                    Ver catálogo artículos
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Última Importación Excel */}
          <div className="card-wrapper excel-card-premium" style={{ marginBottom: 0 }}>
            <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
              <h2 className="card-title" style={{ fontSize: '15px' }}>Importación Precios</h2>
            </div>
            <div className="card-body" style={{ padding: '16px 20px' }}>
              <div className="excel-card-content">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>📄</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                      {latestImport ? (latestImport.nombre_archivo || latestImport.filename || 'Importación activa') : 'Sin historial'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
                      {latestImport && (latestImport.created_at || latestImport.fecha) ? (
                        <>Cargado {new Date(latestImport.created_at || latestImport.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(latestImport.created_at || latestImport.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</>
                      ) : (
                        'No hay sincronizaciones previas'
                      )}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <div className="excel-stat-row">
                    <span>Artículos Nuevos</span>
                    <span style={{ fontWeight: 700 }}>
                      {latestImport ? (latestImport.productos_creados ?? 0) : 0}
                    </span>
                  </div>
                  <div className="excel-stat-row">
                    <span>Precios Actualizados</span>
                    <span style={{ fontWeight: 700 }}>
                      {latestImport ? (latestImport.productos_actualizados ?? 0) : 0}
                    </span>
                  </div>
                  <div className="excel-stat-row" style={{ borderBottom: 'none' }}>
                    <span>Errores / Descartados</span>
                    <span style={{ fontWeight: 700 }}>
                      {latestImport ? (latestImport.filas_rechazadas ?? (Array.isArray(latestImport.errores) ? latestImport.errores.length : 0)) : 0}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => onNavigate?.('excel')}
                  style={{ 
                    marginTop: '8px',
                    width: '100%', 
                    padding: '8px', 
                    borderRadius: 'var(--border-radius-sm)',
                    border: 'none',
                    backgroundColor: 'white',
                    color: '#047857',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                    transition: 'transform 0.1s'
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  Importar Nuevo Archivo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección 5: Gráficos (SVG nativos interactivos) */}
      <div className="charts-row-premium" style={{ marginTop: '28px' }}>
        {/* Gráfico de Barras: Ventas últimos 7 días */}
        <div className="chart-card-wrapper" style={{ position: 'relative' }}>
          <h3 className="chart-card-title">
            Ventas Recientes
            <span style={{ fontSize: '11px', color: 'var(--text-disabled)', fontWeight: 600 }}>ÚLT. 7 DÍAS</span>
          </h3>

          <div style={{ position: 'relative', width: '100%', height: '200px' }}>
            <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
              {/* Líneas de cuadrícula horizontal */}
              <line x1="50" y1="20" x2="380" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="50" y1="65" x2="380" y2="65" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="50" y1="110" x2="380" y2="110" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="50" y1="150" x2="380" y2="150" stroke="#cbd5e1" strokeWidth="1.5" />

              {/* Etiquetas Y */}
              <text x="40" y="24" fill="var(--text-disabled)" fontSize="10" textAnchor="end">${Math.round(maxSaleAmount).toLocaleString('es-AR')}</text>
              <text x="40" y="69" fill="var(--text-disabled)" fontSize="10" textAnchor="end">${Math.round(maxSaleAmount / 2).toLocaleString('es-AR')}</text>
              <text x="40" y="114" fill="var(--text-disabled)" fontSize="10" textAnchor="end">$0</text>

              {/* Dibujo de Barras */}
              {last7DaysSales.map((sale, i) => {
                const barWidth = 26;
                const spacing = (330 - (barWidth * 7)) / 6;
                const x = 50 + i * (barWidth + spacing) + spacing / 2;
                const barHeight = maxSaleAmount > 0 ? (sale.amount / maxSaleAmount) * 120 : 0;
                const y = 150 - barHeight;

                return (
                  <g key={sale.dateStr}>
                    {/* Barra de fondo hover transparente */}
                    <rect
                      x={x - 4}
                      y="15"
                      width={barWidth + 8}
                      height="140"
                      fill="transparent"
                      cursor="pointer"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const parent = e.currentTarget.parentElement?.parentElement?.parentElement?.getBoundingClientRect();
                        if (parent) {
                          setHoveredBar({
                            x: rect.left - parent.left + rect.width / 2,
                            y: rect.top - parent.top,
                            label: sale.label,
                            amount: sale.amount
                          });
                        }
                      }}
                      onMouseLeave={() => setHoveredBar(null)}
                    />
                    {/* Barra real */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(barHeight, 2)}
                      fill={hoveredBar && hoveredBar.label === sale.label ? '#0284c7' : 'var(--accent-color)'}
                      rx="3"
                      className="chart-bar-rect"
                    />
                    {/* Etiqueta X */}
                    <text
                      x={x + barWidth / 2}
                      y="166"
                      fill="var(--text-secondary)"
                      fontSize="9.5"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {sale.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Burbuja Tooltip Dinámica */}
            {hoveredBar && (
              <div 
                className="chart-tooltip-bubble"
                style={{ left: hoveredBar.x, top: hoveredBar.y }}
              >
                <strong>{hoveredBar.label}</strong>: {formatPrice(hoveredBar.amount)}
              </div>
            )}
          </div>
        </div>

        {/* Gráfico Donut: Pedidos por estado */}
        <div className="chart-card-wrapper">
          <h3 className="chart-card-title">
            Estados de Pedidos
            <span style={{ fontSize: '11px', color: 'var(--text-disabled)', fontWeight: 600 }}>TORTA GLOBAL</span>
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '200px' }}>
            <div style={{ width: '160px', height: '160px' }}>
              <svg width="100%" height="100%" viewBox="0 0 200 200">
                {statusDonutData.total === 0 ? (
                  <circle cx="100" cy="100" r="70" fill="none" stroke="#f1f5f9" strokeWidth="18" />
                ) : (
                  statusDonutData.slices.map(slice => {
                    if (slice.pct >= 0.99) {
                      return (
                        <circle
                          key={slice.status}
                          cx="100"
                          cy="100"
                          r="70"
                          fill="none"
                          stroke={slice.color}
                          strokeWidth="18"
                          className="chart-pie-slice"
                        />
                      );
                    }
                    return (
                      <path
                        key={slice.status}
                        d={describeArc(100, 100, 70, slice.startAngle, slice.endAngle)}
                        fill="none"
                        stroke={slice.color}
                        strokeWidth="18"
                        className="chart-pie-slice"
                      />
                    );
                  })
                )}
                {/* Círculo central blanco para efecto dona */}
                <circle cx="100" cy="100" r="58" fill="white" />
                
                {/* Texto central */}
                <text x="100" y="98" fill="var(--text-primary)" fontSize="20" fontWeight="800" textAnchor="middle">
                  {statusDonutData.total}
                </text>
                <text x="100" y="116" fill="var(--text-disabled)" fontSize="9" fontWeight="700" textAnchor="middle" letterSpacing="0.5">
                  PEDIDOS
                </text>
              </svg>
            </div>

            {/* Leyendas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, marginLeft: '20px' }}>
              {statusDonutData.slices.map(slice => (
                <div key={slice.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: slice.color }} />
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {ORDER_STATUS_LABELS[slice.status as OrderStatus] || slice.status}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    {slice.count} ({Math.round(slice.pct * 100)}%)
                  </span>
                </div>
              ))}
              {statusDonutData.slices.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-disabled)', textAlign: 'center' }}>
                  Sin pedidos registrados
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Gráfico de Barras Horizontal: Artículos más vendidos */}
        <div className="chart-card-wrapper">
          <h3 className="chart-card-title">
            Productos Más Vendidos
            <span style={{ fontSize: '11px', color: 'var(--text-disabled)', fontWeight: 600 }}>TOP 5</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '200px', justifyContent: 'center' }}>
            {topSoldProducts.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-disabled)', fontSize: '13px' }}>
                No se registran ventas de artículos en este período.
              </div>
            ) : (
              topSoldProducts.map(p => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                      {p.nombre}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-color)' }}>{p.qty} u</span>
                  </div>
                  {/* Barra de porcentaje */}
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${p.percent}%`, 
                        height: '100%', 
                        backgroundColor: 'var(--accent-color)', 
                        borderRadius: '9999px',
                        transition: 'width 0.5s ease' 
                      }} 
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
