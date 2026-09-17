import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAdminStore } from '../store/adminStore';
import { Order, OrderStatus } from '@shared/types/order';
import { formatPrice } from '@shared/utils/formatCurrency';
import { getOrderStatusLabel, getOrderStatusColor } from '@shared/utils/orderStatusUtils';
import { getPaymentMethodLabel, getPaymentStatusLabel } from '@shared/utils/paymentUtils';
import * as XLSX from 'xlsx';
import { supabase } from '@shared/services/supabaseClient';

export function OrdersView() {
  const { 
    orders, 
    clients, 
    branches, 
    users,
    activeBranchId, 
    globalMinOrderAmount,
    updateGlobalMinOrderAmount,
    fetchOrdersOnly
  } = useAdminStore();

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('all');
  const [localMinAmount, setLocalMinAmount] = useState<string>('');
  const [isSavingMinAmount, setIsSavingMinAmount] = useState(false);

  React.useEffect(() => {
    fetchOrdersOnly();
  }, []);

  React.useEffect(() => {
    setLocalMinAmount(globalMinOrderAmount.toString());
  }, [globalMinOrderAmount]);

  const handleSaveMinAmount = async () => {
    setIsSavingMinAmount(true);
    try {
      await updateGlobalMinOrderAmount(Number(localMinAmount || 0));
    } catch (e) {
      console.error(e);
      alert('Error al guardar el monto mínimo de compra.');
    } finally {
      setIsSavingMinAmount(false);
    }
  };
  
  // Modals / Details State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Filtrado de pedidos
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const client = clients.find(c => String(c.id) === String(o.clienteId) || (c.userId && String(c.userId) === String(o.clienteId)));
      const clientName = o.customerName || (client ? (client.razonSocial || client.nombre || '') : '');
      const query = search.toLowerCase();

      const matchesSearch = 
        o.numero.toLowerCase().includes(query) ||
        clientName.toLowerCase().includes(query);

      const globalBranchFilter = activeBranchId === 'all' || o.branchId === activeBranchId;
      const matchesStatus = selectedStatus === 'all' || o.estado === selectedStatus;
      const matchesPayment = selectedPaymentStatus === 'all' || o.paymentStatus === selectedPaymentStatus;

      return matchesSearch && globalBranchFilter && matchesStatus && matchesPayment;
    });
  }, [orders, clients, search, activeBranchId, selectedStatus, selectedPaymentStatus]);

  const getClientInfo = (clienteId: string | number, order?: Order) => {
    const c = clients.find(item => String(item.id) === String(clienteId) || (item.userId && String(item.userId) === String(clienteId)));
    return {
      name: order?.customerName || (c ? (c.razonSocial || c.nombre) : 'Cliente Desconocido'),
      cuit: c ? c.cuit : '',
      tel: order?.customerPhone || (c ? c.telefono : ''),
      dir: order?.originalAddress || (c ? c.direccion : 'Sin dirección')
    };
  };

  const getBranchName = (bId: string | number) => {
    const b = branches.find(item => String(item.id) === String(bId));
    return b ? b.nombre : 'Sin sucursal';
  };

  const getItemCode = (item: any) => item?.producto?.codigo || item?.codigo || '-';
  const getItemName = (item: any) => item?.producto?.nombre || item?.nombre || 'Artículo sin nombre';
  const getItemPresentation = (item: any) => item?.producto?.presentacion || item?.presentacion || '';
  const getItemPrice = (item: any) => Number(item?.precioUnitario || item?.precio_unitario || item?.producto?.precio || 0);
  const getItemQty = (item: any) => Number(item?.cantidad || 0);

  const handlePrint = (order: Order) => {
    const client = getClientInfo(order.clienteId, order);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsList = order.items || [];
    const itemsRows = itemsList.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${getItemCode(item)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${getItemName(item)}${getItemPresentation(item) ? ` - ${getItemPresentation(item)}` : ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${getItemQty(item)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatPrice(getItemPrice(item))}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatPrice(getItemPrice(item) * getItemQty(item))}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Remito - Pedido ${order.numero}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; margin: 40px; color: #000; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 20px; }
            .details { margin-bottom: 20px; font-size: 14px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .total { text-align: right; margin-top: 20px; font-size: 16px; font-weight: bold; }
            .footer { border-top: 2px dashed #000; margin-top: 40px; padding-top: 20px; font-size: 12px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>QUIMICA & DISTRIBUIDORA</h2>
            <p>Sucursal: ${getBranchName(order.branchId)}</p>
            <p>PEDIDO Nro: ${order.numero}</p>
            <p>Fecha: ${new Date(order.fecha).toLocaleString()}</p>
          </div>
          <div class="details">
            <p><strong>Cliente:</strong> ${client.name}</p>
            <p><strong>CUIT:</strong> ${client.cuit}</p>
            <p><strong>Dirección:</strong> ${client.dir}</p>
            <p><strong>Teléfono:</strong> ${client.tel}</p>
            <p><strong>Método de Pago:</strong> ${getPaymentMethodLabel(order.paymentMethod)} (${getPaymentStatusLabel(order.paymentStatus)})</p>
            ${order.outOfStockPreference ? `<p><strong>Ante falta de stock:</strong> ${order.outOfStockPreference === 'reemplazar' ? '🔄 Elegir artículo similar por el cliente' : '📞 Llamar al cliente para consultar'}</p>` : ''}
            ${order.abonaCon ? `<p><strong>Abona con:</strong> ${formatPrice(order.abonaCon)} | <strong>Vuelto:</strong> ${formatPrice(order.cambioEstimado || 0)}</p>` : ''}
            ${order.observacionesCliente ? `<p><strong>Notas Cliente:</strong> ${order.observacionesCliente}</p>` : ''}
          </div>
          <table class="table">
            <thead>
              <tr style="border-bottom: 1px solid #000;">
                <th style="text-align: left; padding: 8px;">Cod</th>
                <th style="text-align: left; padding: 8px;">Detalle</th>
                <th style="text-align: center; padding: 8px;">Cant</th>
                <th style="text-align: right; padding: 8px;">P.Unit</th>
                <th style="text-align: right; padding: 8px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
          <div class="total">
            TOTAL DEL PEDIDO: ${formatPrice(order.total)}
          </div>
          <div class="footer">
            <p>¡Gracias por su compra!</p>
            <p>Firma de Recepción: ________________________________</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportOrders = () => {
    const dataToExport = filteredOrders.map(o => {
      const client = getClientInfo(o.clienteId, o);
      return {
        Número: o.numero,
        Fecha: `${new Date(o.fecha).toLocaleDateString()} ${new Date(o.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs`,
        Sucursal: getBranchName(o.branchId),
        Cliente: client.name,
        Dirección: client.dir,
        Artículos: o.items.map(it => `${it.producto.nombre} (${it.cantidad})`).join(', '),
        Total: o.total,
        MetodoPago: getPaymentMethodLabel(o.paymentMethod),
        EstadoPago: getPaymentStatusLabel(o.paymentStatus),
        EstadoLogistico: getOrderStatusLabel(o.estado),
      };
    });

    const fileName = `pedidos_export_${Date.now()}.xlsx`;
    const userEmail = useAdminStore.getState().currentUser?.email || '';
    
    supabase
      .from('export_history')
      .insert({
        usuario: userEmail,
        tipo: 'pedidos',
        filtros: { branchId: activeBranchId, search, status: selectedStatus, paymentStatus: selectedPaymentStatus },
        cantidad_registros: dataToExport.length,
        nombre_archivo: fileName
      })
      .then(({ error }) => {
        if (error) console.error(error);
      });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Pedidos');
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Monitor de Pedidos</h1>
          <p className="page-desc">Seguimiento de compras en tiempo real, facturación, despacho y armado de remitos</p>
        </div>
        <button className="btn btn-secondary" onClick={handleExportOrders}>
          📤 Exportar Excel
        </button>
      </div>

      {/* Configuración de Pedido Mínimo */}
      <div className="card-wrapper" style={{ marginBottom: '20px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#eff6ff', borderColor: '#bfdbfe', borderWidth: '1px', borderStyle: 'solid', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '24px' }}>🛒</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#1e3a8a', fontWeight: 'bold' }}>Configuración de Pedido Mínimo</h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#1e40af' }}>Los clientes de la aplicación móvil no podrán confirmar pedidos menores al monto mínimo establecido.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontWeight: '600', color: '#1e3a8a', fontSize: '13px' }}>Monto Mínimo ($):</span>
          <input 
            type="number" 
            className="form-input" 
            style={{ width: '120px', margin: 0, padding: '6px 10px', height: '36px' }} 
            value={localMinAmount} 
            onChange={e => setLocalMinAmount(e.target.value)} 
          />
          <button 
            className="btn btn-primary" 
            style={{ padding: '0 16px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            disabled={isSavingMinAmount} 
            onClick={handleSaveMinAmount}
          >
            {isSavingMinAmount ? 'Guardando...' : '💾 Guardar'}
          </button>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtro */}
      <div className="card-wrapper" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar por nro de pedido o razón social..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ width: '200px' }}>
            <select 
              className="form-select"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todos los estados logísticos</option>
              <option value="recibido">📥 Recibidos</option>
              <option value="en_preparacion">⚙️ En Preparación</option>
              <option value="listo_para_reparto">📦 Listo para Reparto</option>
              <option value="en_reparto">🚚 En Reparto</option>
              <option value="entregado">✅ Entregado</option>
              <option value="cancelado">❌ Cancelado</option>
            </select>
          </div>
          <div style={{ width: '180px' }}>
            <select 
              className="form-select"
              value={selectedPaymentStatus}
              onChange={e => setSelectedPaymentStatus(e.target.value)}
            >
              <option value="all">Todos los pagos</option>
              <option value="pendiente">Pendientes</option>
              <option value="pagado">Pagados</option>
              <option value="rechazado">Rechazados</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Resultados: <strong>{filteredOrders.length}</strong> pedidos
          </div>
        </div>
      </div>

      {/* Tabla de Pedidos */}
      <div className="card-wrapper">
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Número / Fecha</th>
                <th style={{ background: activeBranchId === 'all' ? 'rgba(56, 189, 248, 0.1)' : undefined, color: activeBranchId === 'all' ? '#38bdf8' : undefined }}>
                  {activeBranchId === 'all' ? '🏢 Sucursal de Venta ⭐' : 'Sucursal'}
                </th>
                <th>Cliente</th>
                <th>Artículos</th>
                <th>Monto Total</th>
                <th>Método y Pago</th>
                <th>Cambio / Vuelto</th>
                <th>Estado Logístico</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(o => {
                const client = getClientInfo(o.clienteId, o);
                const orderStatusLabel = getOrderStatusLabel(o.estado);
                const orderStatusColor = getOrderStatusColor(o.estado);
                const branchName = getBranchName(o.branchId);

                return (
                  <tr 
                    key={o.id}
                    onClick={() => setSelectedOrder(o)}
                    style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                    title="Hacé click para ver la dirección, sucursal y detalle completo de la compra"
                  >
                    <td>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#0284c7' }}>#{o.numero}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {new Date(o.fecha).toLocaleDateString()} {new Date(o.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                      </div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <span 
                        className="badge" 
                        style={{ 
                          fontSize: '11px', 
                          fontWeight: 'bold',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: activeBranchId === 'all' ? 'rgba(56, 189, 248, 0.15)' : '#334155',
                          color: activeBranchId === 'all' ? '#38bdf8' : '#e2e8f0',
                          border: activeBranchId === 'all' ? '1px solid rgba(56, 189, 248, 0.4)' : 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        🏢 {branchName}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{client.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>📍 Dir: {client.dir}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}>
                        <strong>{(o.items || []).reduce((acc, it) => acc + (Number(it?.cantidad) || 0), 0)}</strong> ítems
                      </div>
                    </td>
                    <td style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text-primary)' }}>
                      {formatPrice(o.total)}
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: '500' }}>
                        {getPaymentMethodLabel(o.paymentMethod)}
                      </div>
                      <span className={`badge ${o.paymentStatus === 'pagado' ? 'badge-success' : o.paymentStatus === 'rechazado' ? 'badge-error' : 'badge-warning'}`} style={{ fontSize: '10px', marginTop: '2px' }}>
                        {getPaymentStatusLabel(o.paymentStatus)}
                      </span>
                    </td>
                    <td>
                      {o.abonaCon ? (
                        <div style={{ fontSize: '12px' }}>
                          <div>Abona: {formatPrice(o.abonaCon)}</div>
                          <div style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>Vuelto: {formatPrice(o.cambioEstimado || 0)}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>Justo / Transferencia</span>
                      )}
                    </td>
                    <td>
                      <span 
                        className="badge"
                        style={{ 
                          padding: '6px 12px', 
                          fontSize: '11px', 
                          fontWeight: 'bold', 
                          color: '#fff',
                          backgroundColor: orderStatusColor,
                          borderRadius: '4px',
                          display: 'inline-block'
                        }}
                      >
                        {orderStatusLabel}
                      </span>
                    </td>
                    <td className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 10px', fontSize: '12px', background: '#0284c7', color: '#fff', border: 'none', fontWeight: '600' }}
                          onClick={() => setSelectedOrder(o)}
                        >
                          👁️ Detalle
                        </button>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '6px 10px', fontSize: '12px', background: '#3b82f6' }}
                          onClick={() => handlePrint(o)}
                        >
                          🖨️ Imprimir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                    Todavía no hay pedidos cargados.
                  </td>
                </tr>
              ) : filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                    No se encontraron pedidos con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalle de Pedido con Portal para centrado exacto en pantalla */}
      {selectedOrder && createPortal(
        <div 
          className="modal-overlay" 
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOrder(null);
          }}
        >
          <div className="modal-content" style={{ maxWidth: '680px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 className="card-title" style={{ margin: 0, fontSize: '18px' }}>Pedido #{selectedOrder.numero}</h2>
                  <span className="badge" style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#0284c7', border: '1px solid #38bdf8', fontWeight: 'bold' }}>
                    🏢 {getBranchName(selectedOrder.branchId)}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Fecha de Venta: {new Date(selectedOrder.fecha).toLocaleDateString()} a las {new Date(selectedOrder.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>
            
            <div className="modal-body" style={{ padding: '20px', maxHeight: '80vh', overflowY: 'auto' }}>
              {/* Sucursal y Cliente */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>👤 CLIENTE</h4>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{getClientInfo(selectedOrder.clienteId, selectedOrder).name}</div>
                  {getClientInfo(selectedOrder.clienteId, selectedOrder).cuit && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>CUIT/DNI: {getClientInfo(selectedOrder.clienteId, selectedOrder).cuit}</div>
                  )}
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Teléfono: {getClientInfo(selectedOrder.clienteId, selectedOrder).tel || 'Sin registrar'}</div>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🏢 SUCURSAL DE VENTA</h4>
                  <div style={{ fontWeight: 'bold', color: '#0284c7', fontSize: '14px' }}>
                    {getBranchName(selectedOrder.branchId)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Método de Entrega: <strong>{selectedOrder.deliveryMethod === 'whatsapp' ? '📱 WhatsApp' : selectedOrder.deliveryMethod === 'retiro' ? '🏪 Retiro en Sucursal' : '🚚 Reparto a Domicilio'}</strong>
                  </div>
                </div>
              </div>

              {/* Dirección Completa de Entrega */}
              <div style={{ marginBottom: '16px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '14px', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>📍 DIRECCIÓN DE ENTREGA Y UBICACIÓN</span>
                  {selectedOrder.locationVerified && (
                    <span style={{ fontSize: '10px', background: '#10b981', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>✓ Verificada</span>
                  )}
                </h4>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e3a8a' }}>
                  {selectedOrder.originalAddress || selectedOrder.formattedAddress || getClientInfo(selectedOrder.clienteId, selectedOrder).dir}
                </div>
                {selectedOrder.city && (
                  <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>
                    Ciudad / Localidad: <strong>{selectedOrder.city}</strong> {selectedOrder.province ? `, ${selectedOrder.province}` : ''}
                  </div>
                )}
                {selectedOrder.addressReference && (
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px', fontStyle: 'italic', background: '#ffffff', padding: '6px 10px', borderRadius: '4px', border: '1px border #dbeafe' }}>
                    💡 Referencia de ubicación: "{selectedOrder.addressReference}"
                  </div>
                )}
                {selectedOrder.deliveryDate && (
                  <div style={{ fontSize: '12px', color: '#1e40af', marginTop: '6px', fontWeight: '500' }}>
                    📅 Turno de entrega pactado: <strong>{selectedOrder.deliveryDate}</strong> ({selectedOrder.deliveryStartTime || '08:00'} a {selectedOrder.deliveryEndTime || '18:00'} hs)
                  </div>
                )}
              </div>

              {/* Detalle de Artículos Comprados */}
              <h3 style={{ fontSize: '14px', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px', fontWeight: 'bold' }}>🛒 Detalle de los Artículos de la Compra</h3>
              <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="admin-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '8px' }}>Código</th>
                      <th style={{ padding: '8px' }}>Artículo / Descripción</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Cant.</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>P. Unitario</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrder.items || []).map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace', padding: '8px', fontWeight: 'bold' }}>{getItemCode(item)}</td>
                        <td style={{ padding: '8px' }}>{getItemName(item)} {getItemPresentation(item) ? `(${getItemPresentation(item)})` : ''}</td>
                        <td style={{ textAlign: 'center', padding: '8px', fontWeight: 'bold' }}>{getItemQty(item)}</td>
                        <td style={{ textAlign: 'right', padding: '8px' }}>{formatPrice(getItemPrice(item))}</td>
                        <td style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>{formatPrice(getItemPrice(item) * getItemQty(item))}</td>
                      </tr>
                    ))}
                    {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-disabled)' }}>
                          No hay artículos registrados para este pedido.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Forma de Pago y Monto Total */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>Método y Estado de Pago:</span>
                  <strong>{getPaymentMethodLabel(selectedOrder.paymentMethod)} ({getPaymentStatusLabel(selectedOrder.paymentStatus)})</strong>
                </div>
                {selectedOrder.abonaCon && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--success-color)' }}>
                    <span>Abona con:</span>
                    <strong>{formatPrice(selectedOrder.abonaCon)} (Cambio/Vuelto estimado: {formatPrice(selectedOrder.cambioEstimado || 0)})</strong>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '800', borderTop: '1px solid #cbd5e1', paddingTop: '10px', marginTop: '4px' }}>
                  <span>MONTO TOTAL DE VENTA:</span>
                  <span style={{ color: 'var(--accent-color)' }}>{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              {selectedOrder.outOfStockPreference && (
                <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '8px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px' }}>{selectedOrder.outOfStockPreference === 'reemplazar' ? '🔄' : '📞'}</span>
                  <div>
                    <strong>Instrucción ante falta de stock: </strong>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                      {selectedOrder.outOfStockPreference === 'reemplazar' ? 'Elegir artículo similar por el cliente' : 'Llamar al cliente para consultar'}
                    </span>
                  </div>
                </div>
              )}

              {selectedOrder.observacionesCliente && (
                <div style={{ marginTop: '12px', padding: '10px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', fontSize: '12.5px' }}>
                  <strong>Notas del Cliente:</strong>
                  <div style={{ color: '#b45309', marginTop: '2px' }}>"{selectedOrder.observacionesCliente}"</div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={() => { handlePrint(selectedOrder); setSelectedOrder(null); }}>🖨️ Imprimir Factura / Remito</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
