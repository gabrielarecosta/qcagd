import React, { useState, useMemo } from 'react';
import { useAdminStore } from '../store/adminStore';
import type { PaymentLog, PaymentMethod, PaymentStatus } from '@shared/types/payment';

import { formatPrice } from '@shared/utils/formatCurrency';
import { getPaymentMethodLabel, getPaymentStatusLabel } from '@shared/utils/paymentUtils';

export function PaymentsView() {
  const { 
    payments, 
    orders, 
    branches, 
    activeBranchId, 
    confirmPayment, 
    createPaymentLog 
  } = useAdminStore();

  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatedOrderNum, setSimulatedOrderNum] = useState('');
  const [simulatedRef, setSimulatedRef] = useState('');

  // Filter payments
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const globalBranchFilter = activeBranchId === 'all' || p.branchId === activeBranchId;
      const matchesMethod = selectedMethod === 'all' || p.metodo === selectedMethod;
      const matchesStatus = selectedStatus === 'all' || p.estado === selectedStatus;
      return globalBranchFilter && matchesMethod && matchesStatus;
    });
  }, [payments, activeBranchId, selectedMethod, selectedStatus]);

  // Compute stats in real-time
  const stats = useMemo(() => {
    const activePayments = payments.filter(p => activeBranchId === 'all' || p.branchId === activeBranchId);
    
    const cash = activePayments
      .filter(p => p.metodo === 'efectivo' && (p.estado === 'pagado' || p.estado === 'efectivo_al_entregar'))
      .reduce((sum, p) => sum + p.monto, 0);

    const bank = activePayments
      .filter(p => p.metodo === 'transferencia' && p.estado === 'pagado')
      .reduce((sum, p) => sum + p.monto, 0);

    const mp = activePayments
      .filter(p => p.metodo === 'mercado_pago' && p.estado === 'pagado')
      .reduce((sum, p) => sum + p.monto, 0);

    const pendingTransfersCount = activePayments
      .filter(p => p.metodo === 'transferencia' && p.estado === 'pendiente')
      .length;

    return { cash, bank, mp, pendingTransfersCount, total: cash + bank + mp };
  }, [payments, activeBranchId]);

  // Orders that can be paid (pending status)
  const pendingOrders = useMemo(() => {
    return orders.filter(o => o.paymentStatus === 'pendiente');
  }, [orders]);

  const handleConfirmWireTransfer = (orderId: string) => {
    const ref = `TRANSF-CONF-${Math.floor(100000 + Math.random() * 900000)}`;
    confirmPayment(orderId, ref);
  };

  const handleSimulateMP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulatedOrderNum) return;

    const targetOrder = orders.find(o => o.numero === simulatedOrderNum);
    if (!targetOrder) return;

    const transactionId = simulatedRef || `mp-tr-${Math.floor(100000000 + Math.random() * 900000000)}`;
    
    // confirm order payment state
    confirmPayment(targetOrder.id, transactionId);

    // log log
    createPaymentLog({
      orderId: targetOrder.id,
      branchId: targetOrder.branchId,
      fecha: new Date().toISOString(),
      monto: targetOrder.total,
      metodo: 'mercado_pago',
      estado: 'pagado',
      referenciaMock: transactionId,
    });

    setShowSimulator(false);
    setSimulatedOrderNum('');
    setSimulatedRef('');
  };

  const getBranchName = (bId: string) => {
    const b = branches.find(item => item.id === bId);
    return b ? b.nombre : 'Sin sucursal';
  };

  const getOrderNum = (orderId: string) => {
    const o = orders.find(item => item.id === orderId);
    return o ? o.numero : 'Desconocido';
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Caja y Conciliación de Pagos</h1>
          <p className="page-desc">Monitorear cobros de repartidores, verificar transferencias bancarias y simular webhooks de Mercado Pago</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowSimulator(true)} style={{ background: '#009ee3' }}>
          📱 Simular Webhook Mercado Pago
        </button>
      </div>

      {/* KPI Cards */}
      <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="card-wrapper" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#64748b' }}>TOTAL FACTURADO (CONCILIADO)</h4>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: 'var(--accent-color)' }}>{formatPrice(stats.total)}</h2>
        </div>
        <div className="card-wrapper" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#64748b' }}>💵 EFECTIVO EN CAJA</h4>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: 'var(--success-color)' }}>{formatPrice(stats.cash)}</h2>
        </div>
        <div className="card-wrapper" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#64748b' }}>📱 MERCADO PAGO</h4>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#009ee3' }}>{formatPrice(stats.mp)}</h2>
        </div>
        <div className="card-wrapper" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#64748b' }}>🏛️ TRANSFERENCIAS BANCARIAS</h4>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#8b5cf6' }}>{formatPrice(stats.bank)}</h2>
          {stats.pendingTransfersCount > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--error-color)', fontWeight: 'bold', marginTop: '4px' }}>
              ⚠️ {stats.pendingTransfersCount} transferencias pendientes
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card-wrapper" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ width: '180px' }}>
            <select 
              className="form-select"
              value={selectedMethod}
              onChange={e => setSelectedMethod(e.target.value)}
            >
              <option value="all">Todos los métodos</option>
              <option value="efectivo">Efectivo</option>
              <option value="mercado_pago">Mercado Pago</option>
              <option value="transferencia">Transferencia</option>
              <option value="cuenta_corriente">Cuenta Corriente</option>
            </select>
          </div>
          <div style={{ width: '180px' }}>
            <select 
              className="form-select"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="pendiente">Pendientes</option>
              <option value="pagado">Confirmados / Pagados</option>
              <option value="rechazado">Rechazados</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Transacciones encontradas: <strong>{filteredPayments.length}</strong>
          </div>
        </div>
      </div>

      {/* Tabla de Pagos */}
      <div className="card-wrapper">
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Referencia Interna</th>
                <th>Pedido</th>
                <th>Sucursal</th>
                <th>Fecha</th>
                <th>Monto Neto</th>
                <th>Forma de Pago</th>
                <th>Estado de Cobro</th>
                <th>ID Transacción (MP / Banco)</th>
                <th className="text-right">Verificación Manual</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{p.id}</td>
                  <td style={{ fontWeight: 'bold' }}>#{getOrderNum(p.orderId)}</td>
                  <td><span className="badge badge-neutral">{getBranchName(p.branchId)}</span></td>
                  <td>{new Date(p.fecha).toLocaleString()}</td>
                  <td style={{ fontWeight: 'bold', fontSize: '14px' }}>{formatPrice(p.monto)}</td>
                  <td style={{ fontWeight: '500' }}>{getPaymentMethodLabel(p.metodo)}</td>
                  <td>
                    <span className={`badge ${
                      p.estado === 'pagado' ? 'badge-success' : 
                      p.estado === 'pendiente' ? 'badge-warning' : 'badge-error'
                    }`}>
                      {getPaymentStatusLabel(p.estado)}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {p.referenciaMock || <span style={{ color: 'var(--text-disabled)' }}>Sin referencia</span>}
                  </td>
                  <td className="text-right">
                    {p.metodo === 'transferencia' && p.estado === 'pendiente' && (
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--success-color)' }}
                        onClick={() => handleConfirmWireTransfer(p.orderId)}
                      >
                        ✔ Confirmar Transferencia
                      </button>
                    )}
                    {p.metodo === 'efectivo' && p.estado === 'pendiente' && (
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '12px', background: '#3b82f6' }}
                        onClick={() => confirmPayment(p.orderId, 'EFECTIVO-RECIBIDO')}
                      >
                        ✔ Recibido
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                    No se encontraron registros de caja con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulator Modal */}
      {showSimulator && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <form onSubmit={handleSimulateMP}>
              <div className="modal-header">
                <h2 className="card-title">Simulador Webhook de Mercado Pago</h2>
                <button type="button" className="btn-close" onClick={() => setShowSimulator(false)}>✕</button>
              </div>
              <div className="modal-body">
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Simule una confirmación de pago entrante desde la pasarela digital para liquidar facturas al instante.
                </p>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Seleccione Pedido Pendiente</label>
                  <select 
                    className="form-select"
                    value={simulatedOrderNum}
                    onChange={e => setSimulatedOrderNum(e.target.value)}
                    required
                  >
                    <option value="">-- Seleccionar Pedido --</option>
                    {pendingOrders.map(o => (
                      <option key={o.id} value={o.numero}>
                        Pedido #{o.numero} — {formatPrice(o.total)}
                      </option>
                    ))}
                  </select>
                  {pendingOrders.length === 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--error-color)', marginTop: '4px' }}>
                      No hay pedidos pendientes de pago en el sistema.
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">ID de Transacción Simulado (Opcional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: mp-tr-838495204"
                    value={simulatedRef}
                    onChange={e => setSimulatedRef(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSimulator(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#009ee3' }} disabled={!simulatedOrderNum}>
                  ⚡ Disparar IPN Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
