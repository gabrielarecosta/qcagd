import React, { useState, useMemo, useEffect } from 'react';
import { useAdminStore } from '../store/adminStore';
import type { PaymentLog, PaymentMethod, PaymentMethodConfig, PaymentStatus } from '@shared/types/payment';
import { paymentService } from '@shared/services/paymentService';
import { companySettingsService } from '@shared/services/companySettingsService';

import { formatPrice } from '@shared/utils/formatCurrency';
import { getPaymentMethodLabel, getPaymentStatusLabel } from '@shared/utils/paymentUtils';
import { ExtraModuleWrapper } from '../components/ExtraModuleWrapper';

interface PaymentsViewProps {
  initialTab?: 'caja' | 'config';
}

export function PaymentsView({ initialTab = 'caja' }: PaymentsViewProps) {
  const { 
    payments, 
    orders, 
    branches, 
    activeBranchId, 
    confirmPayment, 
    createPaymentLog,
    fetchPaymentsOnly
  } = useAdminStore();

  useEffect(() => {
    fetchPaymentsOnly();
  }, []);

  const [activeTab, setActiveTab] = useState<'caja' | 'config'>(initialTab);
  const [selectedMethod, setSelectedMethod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulatedOrderNum, setSimulatedOrderNum] = useState('');
  const [simulatedRef, setSimulatedRef] = useState('');

  // Sincronizar tab si cambia desde el menú de navegación
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Estados de configuración de medios de pago
  const [paymentConfigs, setPaymentConfigs] = useState<PaymentMethodConfig[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(false);
  const [isSavingConfigs, setIsSavingConfigs] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Estados de configuración de datos bancarios (Transferencia)
  const [bankSettings, setBankSettings] = useState({
    banco: '',
    titular: '',
    cuit: '',
    cbu: '',
    alias_cbu: '',
    tipo_cuenta: 'Cuenta Corriente en Pesos',
    whatsapp_transferencias: '',
    instrucciones_transferencia: 'Enviar comprobante por WhatsApp con el número de pedido para agilizar el despacho.',
  });
  const [isLoadingBank, setIsLoadingBank] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [bankSuccessMsg, setBankSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfigs = async () => {
      setIsLoadingConfigs(true);
      try {
        const configs = await paymentService.getConfigs();
        setPaymentConfigs(configs);
      } catch (err) {
        console.error('Error fetching payment configs in admin:', err);
      } finally {
        setIsLoadingConfigs(false);
      }
    };

    const fetchBankSettings = async () => {
      setIsLoadingBank(true);
      try {
        const data = await companySettingsService.get();
        if (data) {
          setBankSettings({
            banco: data.banco || '',
            titular: data.titular || '',
            cuit: data.cuit || '',
            cbu: data.cbu || '',
            alias_cbu: data.alias_cbu || '',
            tipo_cuenta: data.tipo_cuenta || 'Cuenta Corriente en Pesos',
            whatsapp_transferencias: data.whatsapp_transferencias || data.whatsapp || '',
            instrucciones_transferencia: data.instrucciones_transferencia || 'Enviar comprobante por WhatsApp con el número de pedido para agilizar el despacho.',
          });
        }
      } catch (err) {
        console.error('Error fetching bank settings:', err);
      } finally {
        setIsLoadingBank(false);
      }
    };

    fetchConfigs();
    fetchBankSettings();
  }, []);

  const handleToggleActive = (id: string) => {
    setPaymentConfigs(prev => prev.map(c => c.id === id ? { ...c, activo: !c.activo } : c));
  };

  const handleToggleAudience = (id: string, field: 'disponibleMinorista' | 'disponibleMayorista' | 'disponibleSucursal') => {
    setPaymentConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: !c[field] } : c));
  };

  const handleSaveConfigs = async () => {
    setIsSavingConfigs(true);
    setSaveSuccessMsg(null);
    try {
      const ok = await paymentService.saveAllConfigs(paymentConfigs);
      if (ok) {
        setSaveSuccessMsg('¡Configuración de medios de pago guardada exitosamente en Supabase!');
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      } else {
        alert('No se pudo guardar la configuración. Verifique la conexión con la base de datos.');
      }
    } catch (err) {
      console.error('Error saving payment configs:', err);
      alert('Error guardando configuración.');
    } finally {
      setIsSavingConfigs(false);
    }
  };

  const handleSaveBankSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingBank(true);
    setBankSuccessMsg(null);
    try {
      const ok = await companySettingsService.update(bankSettings);
      if (ok) {
        setBankSuccessMsg('¡Datos bancarios para transferencias actualizados exitosamente en Supabase!');
        setTimeout(() => setBankSuccessMsg(null), 4000);
      } else {
        alert('Error al guardar los datos bancarios. Verifique su conexión.');
      }
    } catch (err) {
      console.error('Error saving bank settings:', err);
      alert('Error al guardar los datos bancarios.');
    } finally {
      setIsSavingBank(false);
    }
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              {activeTab === 'caja' ? 'Caja Avanzada y Conciliación' : 'Medios de Pago & CBU'}
            </h1>
            {activeTab === 'caja' && (
              <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📌 MÓDULO ADICIONAL OPCIONAL (COTIZA APARTE)
              </span>
            )}
          </div>
          <p className="page-desc" style={{ marginTop: '4px' }}>
            {activeTab === 'caja' 
              ? 'Monitorear cobros de repartidores, verificar transferencias bancarias y liquidación de cajas'
              : 'Configurar datos bancarios (CBU/Alias), cuentas de transferencia y habilitación de medios de pago'}
          </p>
        </div>
        {activeTab === 'caja' && (
          <button className="btn btn-primary" onClick={() => setShowSimulator(true)} style={{ background: '#009ee3' }}>
            📱 Simular Webhook Mercado Pago
          </button>
        )}
      </div>

      {/* Tabs Principales */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
        <button
          className={`btn ${activeTab === 'caja' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('caja')}
          style={{ padding: '8px 18px', fontSize: '14px', borderRadius: '8px' }}
        >
          📊 Caja y Conciliación
        </button>
        <button
          className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('config')}
          style={{ padding: '8px 18px', fontSize: '14px', borderRadius: '8px' }}
        >
          ⚙️ Configuración de Medios de Pago & CBU
        </button>
      </div>

      {/* ── TAB 1: CAJA Y CONCILIACIÓN (Módulo Extra) ── */}
      {activeTab === 'caja' && (
        <ExtraModuleWrapper title="Módulo de Caja Avanzado y Conciliación" description="El control avanzado de caja, arqueos y conciliación bancaria/pasarelas se encuentra contemplado como módulo adicional opcional.">
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
              <div style={{ width: '190px' }}>
                <select 
                  className="form-select"
                  value={selectedMethod}
                  onChange={e => setSelectedMethod(e.target.value)}
                >
                  <option value="all">Todos los métodos</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="mercado_pago">Mercado Pago</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="pago_a_acordar">Pago a acordar</option>
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
                    <th>Fecha y Hora</th>
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
                      <td>
                        <div>{new Date(p.fecha).toLocaleDateString()}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {new Date(p.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                        </div>
                      </td>
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
        </ExtraModuleWrapper>
      )}

      {/* ── TAB 2: CONFIGURACIÓN DE MEDIOS DE PAGO & DATOS BANCARIOS (UNLOCKED / EN PROPUESTA) ── */}
      {activeTab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* SECCIÓN 1: DATOS BANCARIOS PARA TRANSFERENCIAS */}
          <div className="card-wrapper" style={{ padding: '24px', backgroundColor: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}>🏦</span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Datos Bancarios para Transferencias de Dinero</h3>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Modifique los datos de su cuenta bancaria. Estos datos se mostrarán automáticamente a los clientes en la App al elegir Transferencia Bancaria y en el detalle de sus pedidos.
                </p>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveBankSettings}
                disabled={isSavingBank}
                style={{ padding: '10px 22px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', background: '#059669' }}
              >
                {isSavingBank ? 'Guardando...' : '💾 Guardar Datos Bancarios'}
              </button>
            </div>

            {bankSuccessMsg && (
              <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✓</span> {bankSuccessMsg}
              </div>
            )}

            {isLoadingBank ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Cargando datos bancarios desde Supabase...
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Formulario de Edición */}
                <form onSubmit={handleSaveBankSettings} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: '600', fontSize: '13px' }}>Banco / Billetera Virtual</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ej: Banco Galicia, Mercado Pago..."
                        value={bankSettings.banco}
                        onChange={e => setBankSettings({ ...bankSettings, banco: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: '600', fontSize: '13px' }}>Tipo de Cuenta</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ej: Cuenta Corriente en Pesos, Caja de Ahorro"
                        value={bankSettings.tipo_cuenta}
                        onChange={e => setBankSettings({ ...bankSettings, tipo_cuenta: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: '600', fontSize: '13px' }}>Titular de la Cuenta / Razón Social</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ej: Química General Deheza S.R.L."
                        value={bankSettings.titular}
                        onChange={e => setBankSettings({ ...bankSettings, titular: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: '600', fontSize: '13px' }}>CUIT / CUIL</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ej: 30-71234567-8"
                        value={bankSettings.cuit}
                        onChange={e => setBankSettings({ ...bankSettings, cuit: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: '600', fontSize: '13px' }}>Alias CBU / CVU</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ej: QUIMICA.DEHEZA"
                        value={bankSettings.alias_cbu}
                        onChange={e => setBankSettings({ ...bankSettings, alias_cbu: e.target.value })}
                        style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: '600', fontSize: '13px' }}>CBU / CVU (22 dígitos)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ej: 0070123420000012345678"
                        value={bankSettings.cbu}
                        onChange={e => setBankSettings({ ...bankSettings, cbu: e.target.value })}
                        style={{ fontFamily: 'monospace' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '13px' }}>
                      💬 WhatsApp para recibir comprobantes de transferencias
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: 5493511234567 o 3511234567"
                      value={bankSettings.whatsapp_transferencias}
                      onChange={e => setBankSettings({ ...bankSettings, whatsapp_transferencias: e.target.value })}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', display: 'block' }}>
                      Número al que será redirigido el cliente cuando presione el botón para enviar su comprobante.
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', fontSize: '13px' }}>Instrucciones adicionales para el cliente</label>
                    <textarea 
                      className="form-input" 
                      rows={2}
                      placeholder="Ej: Enviar comprobante por WhatsApp indicando el número de pedido para agilizar el armado."
                      value={bankSettings.instrucciones_transferencia}
                      onChange={e => setBankSettings({ ...bankSettings, instrucciones_transferencia: e.target.value })}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </form>

                {/* Tarjeta de Vista Previa en Vivo */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>📱 VISTA PREVIA (Cómo lo ve el cliente en la App)</span>
                  </div>

                  <div style={{ background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: '10px', padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span>🏦</span> Datos para transferencia:
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', borderBottom: '1px solid #dbeafe', paddingBottom: '4px' }}>
                      <span style={{ color: '#64748b' }}>Banco:</span>
                      <strong style={{ color: '#0f172a' }}>{bankSettings.banco || '—'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', borderBottom: '1px solid #dbeafe', paddingBottom: '4px' }}>
                      <span style={{ color: '#64748b' }}>Titular:</span>
                      <strong style={{ color: '#0f172a' }}>{bankSettings.titular || '—'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', borderBottom: '1px solid #dbeafe', paddingBottom: '4px' }}>
                      <span style={{ color: '#64748b' }}>Alias:</span>
                      <strong style={{ color: 'var(--primary-color)', fontSize: '13px', background: '#dbeafe', padding: '1px 6px', borderRadius: '4px' }}>
                        {bankSettings.alias_cbu || '—'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', borderBottom: '1px solid #dbeafe', paddingBottom: '4px' }}>
                      <span style={{ color: '#64748b' }}>CBU / CVU:</span>
                      <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{bankSettings.cbu || '—'}</strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', borderBottom: '1px solid #dbeafe', paddingBottom: '4px' }}>
                      <span style={{ color: '#64748b' }}>CUIT:</span>
                      <strong style={{ color: '#0f172a' }}>{bankSettings.cuit || '—'}</strong>
                    </div>

                    {bankSettings.tipo_cuenta && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', borderBottom: '1px solid #dbeafe', paddingBottom: '4px' }}>
                        <span style={{ color: '#64748b' }}>Cuenta:</span>
                        <strong style={{ color: '#0f172a' }}>{bankSettings.tipo_cuenta}</strong>
                      </div>
                    )}

                    {bankSettings.instrucciones_transferencia && (
                      <div style={{ marginTop: '4px', fontSize: '11.5px', color: '#1e40af', background: '#dbeafe', padding: '8px', borderRadius: '6px', fontStyle: 'italic' }}>
                        ℹ️ {bankSettings.instrucciones_transferencia}
                      </div>
                    )}

                    {/* Botón WhatsApp de la App */}
                    <div style={{ marginTop: '10px', background: '#25D366', color: '#ffffff', padding: '10px 14px', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      <span>📲</span> Ya realicé la transferencia, enviar comprobante por WhatsApp
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: CONTROL DE MEDIOS DE PAGO */}
          <div className="card-wrapper" style={{ padding: '24px', backgroundColor: 'var(--card-bg, #ffffff)', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}>⚙️</span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Disponibilidad de Medios de Pago por Tipo de Cliente</h3>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Active o desactive métodos de pago globalmente y personalice su visibilidad para Particulares, Mayoristas y Sucursales.
                </p>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveConfigs}
                disabled={isSavingConfigs}
                style={{ padding: '10px 22px', fontWeight: 'bold' }}
              >
                {isSavingConfigs ? 'Guardando...' : '💾 Guardar Disponibilidad de Medios'}
              </button>
            </div>

            {saveSuccessMsg && (
              <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✓</span> {saveSuccessMsg}
              </div>
            )}

            {isLoadingConfigs ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Cargando configuración de medios de pago...
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {paymentConfigs.map((config) => (
                  <div 
                    key={config.id} 
                    style={{ 
                      backgroundColor: config.activo ? 'var(--card-bg, #ffffff)' : '#f8fafc', 
                      border: `2px solid ${config.activo ? 'var(--border-color, #e2e8f0)' : '#cbd5e1'}`, 
                      borderRadius: '12px', 
                      padding: '20px',
                      opacity: config.activo ? 1 : 0.75,
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                    }}
                  >
                    {/* Header de Método */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>
                            {config.id === 'efectivo' ? '💵' : config.id === 'mercadopago' ? '💳' : config.id === 'transferencia' ? '🏦' : config.id === 'pago_a_acordar' ? '🤝' : '📋'}
                          </span>
                          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>{config.nombre}</h4>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {config.descripcion || 'Sin descripción'}
                        </p>
                      </div>

                      {/* Switch Maestro */}
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: config.activo ? 'var(--success-color)' : 'var(--text-disabled)' }}>
                          {config.activo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                        <input 
                          type="checkbox" 
                          checked={config.activo}
                          onChange={() => handleToggleActive(config.id)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      </label>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '14px 0' }} />

                    {/* Disponibilidad por Segmento */}
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '10px' }}>
                      Disponibilidad por tipo de cuenta:
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* Minoristas / Consumidor Final */}
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: config.activo ? 'pointer' : 'not-allowed', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          👤 <strong>Particulares</strong> (Consumidor Final)
                        </span>
                        <input 
                          type="checkbox" 
                          disabled={!config.activo}
                          checked={config.disponibleMinorista}
                          onChange={() => handleToggleAudience(config.id, 'disponibleMinorista')}
                          style={{ cursor: config.activo ? 'pointer' : 'not-allowed' }}
                        />
                      </label>

                      {/* Mayoristas */}
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: config.activo ? 'pointer' : 'not-allowed', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          🏢 <strong>Clientes Mayoristas</strong>
                        </span>
                        <input 
                          type="checkbox" 
                          disabled={!config.activo}
                          checked={config.disponibleMayorista}
                          onChange={() => handleToggleAudience(config.id, 'disponibleMayorista')}
                          style={{ cursor: config.activo ? 'pointer' : 'not-allowed' }}
                        />
                      </label>

                      {/* Sucursales */}
                      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: config.activo ? 'pointer' : 'not-allowed', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          🏪 <strong>Sucursales</strong>
                        </span>
                        <input 
                          type="checkbox" 
                          disabled={!config.activo}
                          checked={config.disponibleSucursal}
                          onChange={() => handleToggleAudience(config.id, 'disponibleSucursal')}
                          style={{ cursor: config.activo ? 'pointer' : 'not-allowed' }}
                        />
                      </label>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
