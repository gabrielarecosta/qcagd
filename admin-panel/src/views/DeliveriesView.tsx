import React, { useState, useMemo } from 'react';
import { useAdminStore } from '../store/adminStore';
import type { DeliveryRoute, DeliveryStop } from '@shared/types/delivery';
import { formatPrice } from '@shared/utils/formatCurrency';
import * as XLSX from 'xlsx';
import { supabase } from '@shared/services/supabaseClient';


export function DeliveriesView() {
  const { 
    deliveries, 
    orders, 
    clients, 
    branches, 
    users, 
    zones, 
    activeBranchId, 
    createDelivery, 
    updateDeliveryStatus,
    updateOrder,
    drivers
  } = useAdminStore();

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isPlanning, setIsPlanning] = useState(false);

  // Form State for planning new route
  const [formBranchId, setFormBranchId] = useState('branch-gd1');
  const [formDriverId, setFormDriverId] = useState('');
  const [formZona, setFormZona] = useState('');
  const [formTurno, setFormTurno] = useState('08:00 - 12:00 (Mañana)');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Set default driver on open planning modal
  const handleOpenPlanning = () => {
    setIsPlanning(true);
    const firstBranch = activeBranchId !== 'all' ? activeBranchId : (branches[0]?.id || 'branch-gd1');
    setFormBranchId(firstBranch);
    const branchDrivers = drivers.filter(d => d.branchId === firstBranch);
    setFormDriverId(branchDrivers[0]?.id || drivers[0]?.id || '');
    setFormZona(zones[0]?.nombre || 'Zona Centro GD');
    setSelectedOrderIds([]);
  };

  // Orders eligible for delivery route (not yet assigned, associated with branch, and ready/received)
  const eligibleOrders = useMemo(() => {
    // Find all orderIds already in existing deliveries
    const assignedOrderIds = new Set(deliveries.flatMap(d => d.pedidosIds));
    
    return orders.filter(o => {
      const matchesBranch = o.branchId === formBranchId;
      const isNotAssigned = !assignedOrderIds.has(o.id);
      const isCorrectStatus = o.estado === 'recibido' || o.estado === 'en_preparacion' || o.estado === 'listo_para_reparto';
      
      return matchesBranch && isNotAssigned && isCorrectStatus;
    });
  }, [orders, deliveries, formBranchId]);

  // Filter deliveries list
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter(d => {
      const globalBranchFilter = activeBranchId === 'all' || d.branchId === activeBranchId;
      const matchesStatus = selectedStatus === 'all' || d.estado === selectedStatus;
      return globalBranchFilter && matchesStatus;
    });
  }, [deliveries, activeBranchId, selectedStatus]);

  const getDriverName = (driverId: string) => {
    const d = users.find(u => u.id === driverId);
    return d ? d.nombre : 'Sin chofer';
  };

  const getBranchName = (bId: string) => {
    const b = branches.find(item => item.id === bId);
    return b ? b.nombre : 'Sin sucursal';
  };

  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSaveRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDriverId || selectedOrderIds.length === 0) return;

    // Create stops from selected orders
    const stops: DeliveryStop[] = selectedOrderIds.map(oId => {
      const order = orders.find(o => o.id === oId);
      const client = clients.find(c => c.id === order?.clienteId);
      return {
        clienteId: client?.id || '',
        clienteNombre: client?.razonSocial || 'Desconocido',
        direccion: client?.direccion || 'Sin dirección',
        completado: false,
      };
    });

    createDelivery({
      branchId: formBranchId,
      repartidorId: formDriverId,
      fecha: new Date().toISOString().split('T')[0],
      estado: 'armado',
      zona: formZona,
      horarioEstimado: formTurno,
      pedidosIds: selectedOrderIds,
      stops,
      observaciones: '',
    });

    // Update status of all selected orders to "listo_para_reparto"
    selectedOrderIds.forEach(oId => {
      updateOrder(oId, { estado: 'listo_para_reparto', repartidorId: formDriverId });
    });

    setIsPlanning(false);
  };

  const handleDispatchRoute = (deliveryId: string, route: DeliveryRoute) => {
    updateDeliveryStatus(deliveryId, 'en_camino');
    
    // Update all orders on the route to 'en_reparto'
    route.pedidosIds.forEach(oId => {
      updateOrder(oId, { estado: 'en_reparto' });
    });
  };

  const handleCompleteRoute = (deliveryId: string) => {
    updateDeliveryStatus(deliveryId, 'entregado');
  };

  const handleExportDeliveries = () => {
    const dataToExport = filteredDeliveries.flatMap(d => {
      return d.stops.map((stop, sIdx) => ({
        RutaZona: d.zona,
        Sucursal: getBranchName(d.branchId),
        Chofer: getDriverName(d.repartidorId),
        Fecha: d.fecha,
        HorarioEstimado: d.horarioEstimado,
        EstadoRuta: d.estado,
        ParadaNumero: sIdx + 1,
        Cliente: stop.clienteNombre,
        Direccion: stop.direccion,
        Completado: stop.completado ? 'Sí' : 'No',
        HoraReal: stop.horaReal || '',
        MotivoFalla: stop.motivoNoEntrega || '',
      }));
    });

    const fileName = `entregas_export_${Date.now()}.xlsx`;
    const userEmail = useAdminStore.getState().currentUser?.email || 'admin@quimicadeheza.com';

    supabase
      .from('export_history')
      .insert({
        usuario: userEmail,
        tipo: 'entregas',
        filtros: { branchId: activeBranchId, status: selectedStatus },
        cantidad_registros: dataToExport.length,
        nombre_archivo: fileName
      })
      .then(({ error }) => {
        if (error) console.error(error);
      });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Entregas');
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Hojas de Ruta y Repartos</h1>
          <p className="page-desc">Planificar despachos, asignar choferes y monitorear el estado de entregas en caliente</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleExportDeliveries}>
            📤 Exportar Excel
          </button>
          <button className="btn btn-primary" onClick={handleOpenPlanning}>
            🚚 Planificar Nuevo Reparto
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card-wrapper" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ width: '200px' }}>
            <select 
              className="form-select"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="armado">📦 Armado / Pendiente</option>
              <option value="en_camino">🚚 En camino</option>
              <option value="entregado">✅ Completado</option>
              <option value="no_entregado">⚠️ Fallido</option>
              <option value="reprogramado">📅 Reprogramado</option>
            </select>
          </div>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            Hojas de ruta activas: <strong>{filteredDeliveries.length}</strong>
          </div>
        </div>
      </div>

      {/* Listado de Rutas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {filteredDeliveries.map(d => {
          const completedStops = d.stops.filter(s => s.completado).length;
          const failedStops = d.stops.filter(s => s.motivoNoEntrega).length;
          const totalStops = d.stops.length;

          return (
            <div key={d.id} className="card-wrapper" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>Ruta {d.zona}</h3>
                    <span className="badge badge-neutral">{getBranchName(d.branchId)}</span>
                    <span className={`badge ${
                      d.estado === 'entregado' ? 'badge-success' : 
                      d.estado === 'en_camino' ? 'badge-warning' : 'badge-neutral'
                    }`}>
                      {d.estado.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Chofer: <strong>{getDriverName(d.repartidorId)}</strong> | Horario estimado: <strong>{d.horarioEstimado}</strong> | Fecha: {d.fecha}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {d.estado === 'armado' && (
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '8px 14px', fontSize: '13px', background: 'var(--warning-color)' }}
                      onClick={() => handleDispatchRoute(d.id, d)}
                    >
                      🚚 Despachar Chofer
                    </button>
                  )}
                  {d.estado === 'en_camino' && (
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '8px 14px', fontSize: '13px', background: 'var(--success-color)' }}
                      onClick={() => handleCompleteRoute(d.id)}
                    >
                      ✅ Finalizar Hoja de Ruta
                    </button>
                  )}
                </div>
              </div>

              {/* Paradas de la ruta */}
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b' }}>
                  PARADAS ({completedStops}/{totalStops} completadas {failedStops > 0 && `| ${failedStops} fallidas`})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                  {d.stops.map((stop, sIdx) => (
                    <div key={sIdx} style={{ 
                      padding: '10px 12px', 
                      background: stop.completado ? 'var(--success-light)' : stop.motivoNoEntrega ? 'var(--error-light)' : '#f8fafc',
                      borderRadius: '6px', 
                      border: '1px solid',
                      borderColor: stop.completado ? 'var(--success-color)' : stop.motivoNoEntrega ? 'var(--error-color)' : '#e2e8f0'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{stop.clienteNombre}</span>
                        <span>{stop.completado ? '✅' : stop.motivoNoEntrega ? '❌' : '⏳'}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {stop.direccion}
                      </div>
                      {stop.horaReal && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Entregado: {stop.horaReal}
                        </div>
                      )}
                      {stop.motivoNoEntrega && (
                        <div style={{ fontSize: '11px', color: 'var(--error-color)', fontWeight: 'bold', marginTop: '2px' }}>
                          Motivo: {stop.motivoNoEntrega}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {deliveries.length === 0 ? (
          <div className="card-wrapper" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-disabled)' }}>
            Todavía no hay hojas de ruta de reparto planificadas.
          </div>
        ) : filteredDeliveries.length === 0 && (
          <div className="card-wrapper" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-disabled)' }}>
            No se encontraron hojas de ruta vigentes con los filtros aplicados.
          </div>
        )}
      </div>

      {/* Modal Planificar Reparto */}
      {isPlanning && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <form onSubmit={handleSaveRoute}>
              <div className="modal-header">
                <h2 className="card-title">Armar Hoja de Ruta</h2>
                <button type="button" className="btn-close" onClick={() => setIsPlanning(false)}>✕</button>
              </div>
              
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Sucursal Emisora</label>
                    <select 
                      className="form-select"
                      value={formBranchId}
                      onChange={e => {
                        setFormBranchId(e.target.value);
                        // Reset driver to one from target branch if possible
                        const branchDrivers = drivers.filter(d => d.branchId === e.target.value);
                        setFormDriverId(branchDrivers[0]?.id || drivers[0]?.id || '');
                        setSelectedOrderIds([]);
                      }}
                    >
                      {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Chofer Asignado</label>
                    <select 
                      className="form-select"
                      value={formDriverId}
                      onChange={e => setFormDriverId(e.target.value)}
                      required
                    >
                      <option value="">-- Seleccionar Repartidor --</option>
                      {drivers.filter(d => formBranchId === 'all' || d.branchId === formBranchId).map(d => (
                        <option key={d.id} value={d.id}>{d.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Zona de Reparto</label>
                    <select 
                      className="form-select"
                      value={formZona}
                      onChange={e => setFormZona(e.target.value)}
                    >
                      {zones.map(z => <option key={z.id} value={z.nombre}>{z.nombre}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Turno Estimado</label>
                    <select 
                      className="form-select"
                      value={formTurno}
                      onChange={e => setFormTurno(e.target.value)}
                    >
                      <option value="08:00 - 12:00 (Mañana)">08:00 - 12:00 (Mañana)</option>
                      <option value="12:00 - 16:00 (Mediodía)">12:00 - 16:00 (Mediodía)</option>
                      <option value="16:00 - 20:00 (Tarde)">16:00 - 20:00 (Tarde)</option>
                    </select>
                  </div>
                </div>

                {/* Pedidos sin asignar */}
                <h3 style={{ fontSize: '14px', marginBottom: '12px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
                  Pedidos Pendientes de Despacho en {getBranchName(formBranchId)} ({eligibleOrders.length})
                </h3>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '16px' }}>
                  {eligibleOrders.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-disabled)', fontSize: '13px' }}>
                      No hay pedidos pendientes en esta sucursal listos para despacho.
                    </div>
                  ) : (
                    <table className="admin-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                          <th style={{ width: '40px', padding: '6px' }}>Sel</th>
                          <th style={{ padding: '6px' }}>Pedido</th>
                          <th style={{ padding: '6px' }}>Cliente / Dirección</th>
                          <th style={{ padding: '6px' }}>Monto</th>
                          <th style={{ padding: '6px' }}>Pago</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eligibleOrders.map(o => {
                          const client = clients.find(c => c.id === o.clienteId);
                          return (
                            <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => toggleOrderSelection(o.id)}>
                              <td style={{ padding: '6px', textAlign: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  checked={selectedOrderIds.includes(o.id)}
                                  onChange={() => {}} // handled by row click
                                />
                              </td>
                              <td style={{ fontWeight: 'bold', padding: '6px' }}>#{o.numero}</td>
                              <td style={{ padding: '6px' }}>
                                <strong>{client?.razonSocial}</strong>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{client?.direccion}</div>
                              </td>
                              <td style={{ padding: '6px' }}>{formatPrice(o.total)}</td>
                              <td style={{ padding: '6px' }}>{o.paymentMethod.toUpperCase()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={{ fontSize: '13px', background: 'var(--accent-light)', padding: '10px 14px', borderRadius: '6px', color: '#0369a1' }}>
                  Paradas seleccionadas: <strong>{selectedOrderIds.length} paradas</strong>
                </div>

              </div>

              <div className="modal-footer" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPlanning(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={selectedOrderIds.length === 0 || !formDriverId}>
                  🚚 Guardar y Armar Ruta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
