import React, { useState, useEffect, useMemo } from 'react';
import { useAdminStore } from '../store/adminStore';
import { reportService } from '@shared/services/reportService';
import { formatPrice } from '@shared/utils/formatCurrency';
import { getPaymentMethodLabel } from '@shared/utils/paymentUtils';
import { getOrderStatusLabel } from '@shared/utils/orderStatusUtils';
import * as XLSX from 'xlsx';
import { supabase } from '@shared/services/supabaseClient';

export function ReportsView() {
  const { activeBranchId } = useAdminStore();
  const [kpis, setKpis] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    const branchFilter = activeBranchId === 'all' ? undefined : activeBranchId;
    
    Promise.all([
      reportService.getKPIs(branchFilter),
      reportService.getGeneralReports(branchFilter)
    ]).then(([kpisData, reportsData]) => {
      if (active) {
        setKpis(kpisData);
        setReports(reportsData);
        setIsLoading(false);
      }
    }).catch(err => {
      console.error('Error loading reports', err);
      if (active) {
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [activeBranchId]);

  // Encontrar el valor máximo para escalar el gráfico de barras por día
  const maxDaySales = useMemo(() => {
    if (!reports || reports.ventasPorDia.length === 0) return 1;
    return Math.max(...reports.ventasPorDia.map((d: any) => d.value), 1);
  }, [reports]);

  // Encontrar el valor máximo para escalar las ventas por sucursal
  const maxBranchSales = useMemo(() => {
    if (!reports || reports.ventasPorSucursal.length === 0) return 1;
    return Math.max(...reports.ventasPorSucursal.map((s: any) => s.value), 1);
  }, [reports]);

  const handleExportStats = () => {
    if (!reports || !kpis) return;
    
    const kpisData = [
      { Métrica: 'Facturación Hoy', Valor: kpis.ventasDia },
      { Métrica: 'Ventas 7 Días', Valor: kpis.ventasSemana },
      { Métrica: 'Clientes Cargados', Valor: kpis.clientesActivos },
      { Métrica: 'Alertas Stock Bajo', Valor: kpis.bajoStockCount },
    ];

    const fileName = `reportes_export_${Date.now()}.xlsx`;
    const userEmail = useAdminStore.getState().currentUser?.email || 'admin@quimicadeheza.com';

    supabase
      .from('export_history')
      .insert({
        usuario: userEmail,
        tipo: 'reportes',
        filtros: { branchId: activeBranchId },
        cantidad_registros: kpisData.length + reports.ventasPorDia.length + reports.ventasPorSucursal.length,
        nombre_archivo: fileName
      })
      .then(({ error }) => {
        if (error) console.error(error);
      });

    const workbook = XLSX.utils.book_new();

    const wsKpis = XLSX.utils.json_to_sheet(kpisData);
    XLSX.utils.book_append_sheet(workbook, wsKpis, 'Resumen KPIs');

    const wsDia = XLSX.utils.json_to_sheet(reports.ventasPorDia.map((d: any) => ({ Fecha: d.label, Ventas: d.value })));
    XLSX.utils.book_append_sheet(workbook, wsDia, 'Ventas por Día');

    const wsSucursal = XLSX.utils.json_to_sheet(reports.ventasPorSucursal.map((s: any) => ({ Sucursal: s.label, Ventas: s.value })));
    XLSX.utils.book_append_sheet(workbook, wsSucursal, 'Ventas por Sucursal');

    const wsProd = XLSX.utils.json_to_sheet(reports.productosMasVendidos.map((p: any) => ({ Producto: p.nombre, Cantidad: p.cantidad, TotalFacturado: p.total })));
    XLSX.utils.book_append_sheet(workbook, wsProd, 'Productos Top');

    const wsCli = XLSX.utils.json_to_sheet(reports.clientesMasActivos.map((c: any) => ({ Cliente: c.nombre, Pedidos: c.pedidosCount, TotalGastado: c.totalGastado })));
    XLSX.utils.book_append_sheet(workbook, wsCli, 'Clientes VIP');

    XLSX.writeFile(workbook, fileName);
  };

  if (isLoading || !kpis || !reports) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(0,0,0,0.1)',
          borderTop: '3px solid var(--primary-color)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '12px'
        }} />
        <p style={{ color: 'var(--text-secondary)' }}>Procesando estadísticas...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Estadísticas y Reportes</h1>
          <p className="page-desc">Informes analíticos de facturación, desempeño de sucursales y rotación de stock</p>
        </div>
        <button className="btn btn-secondary" onClick={handleExportStats}>
          📤 Exportar Excel Completo
        </button>
      </div>

      {/* Tarjetas KPI de Resumen */}
      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="card-wrapper" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#64748b' }}>FACTURACIÓN HOY</h4>
          <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: 'var(--success-color)' }}>{formatPrice(kpis.ventasDia)}</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>Liquidado en sucursales activas</p>
        </div>
        <div className="card-wrapper" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#64748b' }}>VENTAS ÚLTIMOS 7 DÍAS</h4>
          <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: 'var(--accent-color)' }}>{formatPrice(kpis.ventasSemana)}</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>Volumen total consolidado</p>
        </div>
        <div className="card-wrapper" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#64748b' }}>CLIENTES CARGADOS</h4>
          <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: 'var(--primary-color)' }}>{kpis.clientesActivos}</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>Cuentas corrientes operativas</p>
        </div>
        <div className="card-wrapper" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#64748b' }}>BAJO STOCK / ALERTAS</h4>
          <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: kpis.bajoStockCount > 0 ? 'var(--error-color)' : 'var(--success-color)' }}>
            {kpis.bajoStockCount}
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>Productos en punto de reposición</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', marginBottom: '24px', flexWrap: 'wrap' }}>
        
        {/* Gráfico de Barras: Ventas Diarias */}
        <div className="card-wrapper" style={{ padding: '24px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '15px' }}>📈 Evolución de Facturación Diaria (Entregados)</h3>
          
          <div style={{ 
            height: '220px', 
            display: 'flex', 
            alignItems: 'flex-end', 
            justifyContent: 'space-between', 
            paddingTop: '20px',
            borderBottom: '2px solid var(--border-color)',
            marginBottom: '12px'
          }}>
            {reports.ventasPorDia.map((d: any, i: number) => {
              const heightPct = Math.max((d.value / maxDaySales) * 100, 4); // mínimo 4% para visualizar
              return (
                <div key={i} style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '8px',
                  height: '100%',
                  justifyContent: 'flex-end'
                }}>
                  {/* Etiqueta flotante con el monto */}
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                    {d.value > 0 ? `$${Math.round(d.value / 1000)}k` : '$0'}
                  </span>
                  
                  {/* Barra */}
                  <div style={{ 
                    width: '60%', 
                    height: `${heightPct}%`, 
                    background: 'linear-gradient(to top, var(--accent-color), #06b6d4)', 
                    borderRadius: '4px 4px 0 0',
                    transition: 'all 0.3s ease',
                    boxShadow: 'var(--shadow-sm)'
                  }} title={`${d.label}: ${formatPrice(d.value)}`} />
                  
                  {/* Etiqueta del día */}
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', transform: 'rotate(-15deg)', marginTop: '4px', whiteSpace: 'nowrap' }}>
                    {d.label}
                  </span>
                </div>
              );
            })}
            {reports.ventasPorDia.length === 0 && (
              <p style={{ width: '100%', textAlign: 'center', color: 'var(--text-disabled)', paddingBottom: '80px' }}>
                No hay ventas registradas en el período.
              </p>
            )}
          </div>
        </div>

        {/* Ventas por Sucursal */}
        <div className="card-wrapper" style={{ padding: '24px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '15px' }}>🏢 Facturación Acumulada por Sucursal</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {reports.ventasPorSucursal.map((s: any, idx: number) => {
              const widthPct = (s.value / maxBranchSales) * 100;
              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                    <span>{s.label}</span>
                    <span style={{ color: 'var(--accent-color)' }}>{formatPrice(s.value)}</span>
                  </div>
                  {/* Progress Bar Container */}
                  <div style={{ width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${widthPct}%`, 
                      height: '100%', 
                      background: 'linear-gradient(to right, #3b82f6, var(--accent-color))',
                      borderRadius: '5px'
                    }} />
                  </div>
                </div>
              );
            })}
            {reports.ventasPorSucursal.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-disabled)', fontSize: '13px' }}>
                No hay registros de facturación consolidados.
              </p>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap', marginBottom: '24px' }}>
        
        {/* Medios de Pago */}
        <div className="card-wrapper" style={{ padding: '24px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '15px' }}>💳 Métodos de Pago más Utilizados (Volumen Transacciones)</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reports.pagosMasUsados.map((p: any, idx: number) => {
              const totalTransactions = reports.pagosMasUsados.reduce((sum: number, item: any) => sum + item.value, 0) || 1;
              const percent = Math.round((p.value / totalTransactions) * 100);
              
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: '150px', fontSize: '13px', fontWeight: 'bold' }}>
                    {getPaymentMethodLabel(p.label as any)}
                  </div>
                  <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px', margin: '0 12px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${percent}%`, 
                      height: '100%', 
                      background: idx === 0 ? '#10b981' : idx === 1 ? '#009ee3' : '#8b5cf6',
                      borderRadius: '4px'
                    }} />
                  </div>
                  <div style={{ width: '80px', textAlign: 'right', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {p.value} ped. ({percent}%)
                  </div>
                </div>
              );
            })}
            {reports.pagosMasUsados.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-disabled)' }}>No hay transacciones.</p>
            )}
          </div>
        </div>

        {/* Estados de los Pedidos */}
        <div className="card-wrapper" style={{ padding: '24px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '15px' }}>📦 Distribución del Flujo de Pedidos</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
            {reports.pedidosPorEstado.map((e: any, idx: number) => (
              <div key={idx} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                  {getOrderStatusLabel(e.label as any)}
                </span>
                <strong style={{ fontSize: '20px', color: 'var(--primary-color)' }}>{e.value}</strong>
                <span style={{ fontSize: '11px', color: 'var(--text-disabled)', display: 'block' }}>órdenes</span>
              </div>
            ))}
            {reports.pedidosPorEstado.length === 0 && (
              <p style={{ width: '100%', textAlign: 'center', color: 'var(--text-disabled)' }}>No hay pedidos.</p>
            )}

          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* Productos Más Vendidos */}
        <div className="card-wrapper" style={{ padding: '20px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '15px' }}>⭐ Top 5 Productos más Vendidos</h3>
          <div className="table-container">
            <table className="admin-table" style={{ fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Nombre Producto</th>
                  <th style={{ textAlign: 'center' }}>Cantidad</th>
                  <th style={{ textAlign: 'right' }}>Total Facturado</th>
                </tr>
              </thead>
              <tbody>
                {reports.productosMasVendidos.map((p: any, i: number) => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ color: 'var(--text-secondary)', marginRight: '6px', fontWeight: 'bold' }}>#{i+1}</span>
                      <strong>{p.nombre}</strong>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{p.cantidad} u.</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success-color)' }}>
                      {formatPrice(p.total)}
                    </td>
                  </tr>
                ))}
                {reports.productosMasVendidos.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-disabled)' }}>
                      Sin transacciones registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Clientes Más Activos */}
        <div className="card-wrapper" style={{ padding: '20px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '15px' }}>👑 Clientes VIP (Volumen de Compra)</h3>
          <div className="table-container">
            <table className="admin-table" style={{ fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th style={{ textAlign: 'center' }}>Nro Pedidos</th>
                  <th style={{ textAlign: 'right' }}>Total Consolidado</th>
                </tr>
              </thead>
              <tbody>
                {reports.clientesMasActivos.map((c: any, i: number) => (
                  <tr key={c.id}>
                    <td>
                      <span style={{ color: 'var(--text-secondary)', marginRight: '6px', fontWeight: 'bold' }}>#{i+1}</span>
                      <strong>{c.nombre}</strong>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{c.pedidosCount} envíos</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                      {formatPrice(c.totalGastado)}
                    </td>
                  </tr>
                ))}
                {reports.clientesMasActivos.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-disabled)' }}>
                      Sin compras confirmadas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
