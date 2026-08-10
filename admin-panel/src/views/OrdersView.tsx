import React, { useState, useMemo } from 'react';
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
    updateOrderStatus,
    updateOrder,
    drivers,
    globalMinOrderAmount,
    updateGlobalMinOrderAmount
  } = useAdminStore();

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string>('all');
  const [localMinAmount, setLocalMinAmount] = useState<string>('');
  const [isSavingMinAmount, setIsSavingMinAmount] = useState(false);

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

  // Chofer asignación rápida
  const choferes = drivers;

  // Filtrado de pedidos
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const client = clients.find(c => c.id === o.clienteId);
      const clientName = client ? (client.nombre || client.razonSocial || '') : '';
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

  const getClientInfo = (clienteId: string, order?: Order) => {
    const c = clients.find(item => item.id === clienteId);
    return {
      name: order?.customerName || (c ? (c.razonSocial || c.nombre) : 'Desconocido'),
      cuit: c ? c.cuit : '',
      tel: c ? c.telefono : '',
      dir: order?.originalAddress || (c ? c.direccion : 'Sin dirección')
    };
  };

  const getBranchName = (bId: string) => {
    const b = branches.find(item => item.id === bId);
    return b ? b.nombre : 'Sin sucursal';
  };

  const handlePrint = (order: Order) => {
    const client = getClientInfo(order.clienteId, order);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsRows = order.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.producto.codigo}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.producto.nombre} - ${item.producto.presentacion}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.cantidad}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatPrice(item.precioUnitario)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatPrice(item.precioUnitario * item.cantidad)}</td>
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

  const handleUpdateStatus = (id: string, value: string) => {
    updateOrderStatus(id, value as OrderStatus);
  };

  const handleAssignDriver = (orderId: string, driverId: string) => {
    updateOrder(orderId, { repartidorId: driverId || undefined });
  };

  const handleExportOrders = () => {
    const dataToExport = filteredOrders.map(o => {
      const client = getClientInfo(o.clienteId, o);
      return {
        Número: o.numero,
        Fecha: new Date(o.fecha).toLocaleString(),
        Sucursal: getBranchName(o.branchId),
        Cliente: client.name,
        Dirección: client.dir,
        Artículos: o.items.map(it => `${it.producto.nombre} (${it.cantidad})`).join(', '),
        Total: o.total,
        MetodoPago: getPaymentMethodLabel(o.paymentMethod),
        EstadoPago: getPaymentStatusLabel(o.paymentStatus),
        Estado: getOrderStatusLabel(o.estado),
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
          <div style={{ width: '180px' }}>
            <select 
              className="form-select"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
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
                <th>Sucursal</th>
                <th>Cliente</th>
                <th>Artículos</th>
                <th>Monto Total</th>
                <th>Método y Pago</th>
                <th>Cambio / Vuelto</th>
                <th>Asignar Repartidor</th>
                <th>Estado Operativo</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(o => {
                const client = getClientInfo(o.clienteId, o);
                const orderStatusLabel = getOrderStatusLabel(o.estado);
                const orderStatusColor = getOrderStatusColor(o.estado);
                const activeDriver = choferes.find(d => d.id === o.repartidorId);

                return (
                  <tr key={o.id}>
                    <td>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>#{o.numero}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {new Date(o.fecha).toLocaleDateString()} {new Date(o.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                        {getBranchName(o.branchId)}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600' }}>{client.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Dir: {client.dir}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}>
                        <strong>{o.items.reduce((acc, it) => acc + it.cantidad, 0)}</strong> ítems
                      </div>
                    </td>
                    <td style={{ fontWeight: 'bold', fontSize: '14px' }}>
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
                      <select
                        className="form-select"
                        style={{ padding: '4px 8px', fontSize: '12px', width: '130px' }}
                        value={o.repartidorId || ''}
                        onChange={e => handleAssignDriver(o.id, e.target.value)}
                      >
                        <option value="">-- Sin asignar --</option>
                        {choferes.map(d => (
                          <option key={d.id} value={d.id}>{d.nombre}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select 
                        className="form-select"
                        style={{ 
                          padding: '6px 12px', 
                          fontSize: '12px', 
                          fontWeight: 'bold', 
                          color: '#fff',
                          backgroundColor: orderStatusColor,
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        value={o.estado}
                        onChange={e => handleUpdateStatus(o.id, e.target.value)}
                      >
                        <option value="recibido" style={{ color: '#000', backgroundColor: '#fff' }}>Recibido</option>
                        <option value="en_preparacion" style={{ color: '#000', backgroundColor: '#fff' }}>En Preparación</option>
                        <option value="listo_para_reparto" style={{ color: '#000', backgroundColor: '#fff' }}>Listo para Reparto</option>
                        <option value="en_reparto" style={{ color: '#000', backgroundColor: '#fff' }}>En Reparto</option>
                        <option value="entregado" style={{ color: '#000', backgroundColor: '#fff' }}>Entregado</option>
                        <option value="cancelado" style={{ color: '#000', backgroundColor: '#fff' }}>Cancelado</option>
                      </select>
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 10px', fontSize: '12px' }}
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
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                    Todavía no hay pedidos cargados.
                  </td>
                </tr>
              ) : filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                    No se encontraron pedidos con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Detalle de Pedido */}
      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>Detalle de Pedido #{selectedOrder.numero}</h2>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Ingresado el {new Date(selectedOrder.fecha).toLocaleString()}
                </div>
              </div>
              <button type="button" className="btn-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>
            
            <div className="modal-body" style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#64748b' }}>CLIENTE</h4>
                  <div style={{ fontWeight: 'bold' }}>{getClientInfo(selectedOrder.clienteId, selectedOrder).name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>CUIT: {getClientInfo(selectedOrder.clienteId, selectedOrder).cuit}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Tel: {getClientInfo(selectedOrder.clienteId, selectedOrder).tel}</div>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#64748b' }}>ENTREGA</h4>
                  <div>{getClientInfo(selectedOrder.clienteId, selectedOrder).dir}</div>
                  <div style={{ fontSize: '12px', color: 'var(--accent-color)', fontWeight: 'bold', marginTop: '4px' }}>
                    Sucursal: {getBranchName(selectedOrder.branchId)}
                  </div>
                </div>
              </div>

              <h3 style={{ fontSize: '14px', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Artículos del Pedido</h3>
              <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px' }}>
                <table className="admin-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '6px' }}>Cod</th>
                      <th style={{ padding: '6px' }}>Artículo</th>
                      <th style={{ padding: '6px', textAlign: 'center' }}>Cant</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>P.Unit</th>
                      <th style={{ padding: '6px', textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace', padding: '6px' }}>{item.producto.codigo}</td>
                        <td style={{ padding: '6px' }}>{item.producto.nombre} ({item.producto.presentacion})</td>
                        <td style={{ textAlign: 'center', padding: '6px' }}>{item.cantidad}</td>
                        <td style={{ textAlign: 'right', padding: '6px' }}>{formatPrice(item.precioUnitario)}</td>
                        <td style={{ textAlign: 'right', padding: '6px', fontWeight: 'bold' }}>{formatPrice(item.precioUnitario * item.cantidad)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>Forma de pago:</span>
                  <strong>{getPaymentMethodLabel(selectedOrder.paymentMethod)} ({getPaymentStatusLabel(selectedOrder.paymentStatus)})</strong>
                </div>
                {selectedOrder.abonaCon && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--success-color)' }}>
                    <span>Paga con:</span>
                    <strong>{formatPrice(selectedOrder.abonaCon)} (Cambio: {formatPrice(selectedOrder.cambioEstimado || 0)})</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span>Método de entrega:</span>
                  <strong>{selectedOrder.deliveryMethod === 'whatsapp' ? 'WhatsApp' : selectedOrder.deliveryMethod === 'retiro' ? 'Retiro' : 'Reparto'}</strong>
                </div>
                {selectedOrder.deliveryDate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span>Fecha de entrega:</span>
                    <strong>{selectedOrder.deliveryDate} ({selectedOrder.deliveryStartTime} a {selectedOrder.deliveryEndTime} hs)</strong>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '800', marginTop: '8px' }}>
                  <span>TOTAL ESTIMADO:</span>
                  <span style={{ color: 'var(--accent-color)' }}>{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              {selectedOrder.observacionesCliente && (
                <div style={{ marginTop: '16px', padding: '10px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '6px', fontSize: '13px' }}>
                  <strong>Observaciones del Cliente:</strong>
                  <div style={{ color: '#b45309', marginTop: '4px' }}>"{selectedOrder.observacionesCliente}"</div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={() => { handlePrint(selectedOrder); setSelectedOrder(null); }}>🖨️ Imprimir Factura / Remito</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
