import React, { useState } from 'react';
import { useAdminStore } from '../store/adminStore';
import { Branch } from '@shared/types/branch';
import { formatPrice } from '@shared/utils/formatCurrency';

export function BranchesView() {
  const { branches, updateBranch, orders, users, deliveries } = useAdminStore();
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    updateBranch(editingBranch.id, editingBranch);
    setEditingBranch(null);
  };

  // Calcular estadísticas para cada sucursal en caliente
  const getBranchStats = (branchId: string) => {
    const branchOrders = orders.filter(o => o.branchId === branchId);
    const branchDeliverersCount = users.filter(u => u.branchId === branchId && u.rol === 'repartidor').length;
    const totalSales = branchOrders
      .filter(o => o.estado === 'entregado')
      .reduce((sum, o) => sum + o.total, 0);

    return {
      ordersCount: branchOrders.length,
      deliverersCount: branchDeliverersCount,
      sales: totalSales,
    };
  };

  return (
    <div>
      <div>
        <h1 className="page-title">Gestión de Sucursales</h1>
        <p className="page-desc">Administrar puntos de venta, datos de contacto y estados operativos</p>
      </div>

      <div className="card-wrapper">
        <div className="card-header">
          <h2 className="card-title">Listado de Sucursales</h2>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Dirección</th>
                  <th>Contacto</th>
                  <th>Horario</th>
                  <th>Pedidos</th>
                  <th>Ventas</th>
                  <th>Estado</th>
                  <th className="text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(b => {
                  const stats = getBranchStats(b.id);
                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 'bold' }}>{b.nombre}</td>
                      <td>{b.direccion}</td>
                      <td>
                        <div style={{ fontSize: '13px' }}>📞 {b.telefono}</div>
                        <div style={{ fontSize: '13px', color: '#16a34a' }}>💬 WA: {b.whatsapp}</div>
                      </td>
                      <td style={{ fontSize: '13px' }}>{b.horarioAtencion}</td>
                      <td>{stats.ordersCount} pedidos</td>
                      <td style={{ fontWeight: '600' }}>{formatPrice(stats.sales)}</td>
                      <td>
                        <span className={`badge ${b.activo ? 'badge-success' : 'badge-error'}`}>
                          {b.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="text-right">
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => setEditingBranch(b)}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal para Editar */}
      {editingBranch && (
        <div className="modal-overlay">
          <div className="modal-content">
            <form onSubmit={handleSave}>
              <div className="modal-header">
                <h2 className="card-title">Editar Sucursal</h2>
                <button 
                  type="button" 
                  onClick={() => setEditingBranch(null)} 
                  style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Nombre</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editingBranch.nombre}
                      onChange={e => setEditingBranch({ ...editingBranch, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select 
                      className="form-select"
                      value={editingBranch.activo ? 'true' : 'false'}
                      onChange={e => setEditingBranch({ ...editingBranch, activo: e.target.value === 'true' })}
                    >
                      <option value="true">Activa</option>
                      <option value="false">Inactiva</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Dirección</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editingBranch.direccion}
                    onChange={e => setEditingBranch({ ...editingBranch, direccion: e.target.value })}
                    required
                  />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editingBranch.telefono}
                      onChange={e => setEditingBranch({ ...editingBranch, telefono: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">WhatsApp (sin +)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editingBranch.whatsapp}
                      onChange={e => setEditingBranch({ ...editingBranch, whatsapp: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">Horario de Atención</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editingBranch.horarioAtencion}
                    onChange={e => setEditingBranch({ ...editingBranch, horarioAtencion: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingBranch(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
