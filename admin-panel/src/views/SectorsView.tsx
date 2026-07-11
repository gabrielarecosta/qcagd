import React, { useState } from 'react';
import { useAdminStore } from '../store/adminStore';
import type { Sector } from '@shared/types/sector';

import { getBranchName } from '@shared/utils/branchUtils';

export function SectorsView() {
  const { sectors, createSector, updateSector, users, branches, activeBranchId } = useAdminStore();
  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranchId === 'all' ? 'branch-gd1' : activeBranchId);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [newSector, setNewSector] = useState<Omit<Sector, 'id'>>({
    branchId: selectedBranch,
    nombre: '',
    descripcion: '',
    activo: true
  });
  const [showAddModal, setShowAddModal] = useState(false);

  // Filtrar sectores por la sucursal seleccionada
  const filteredSectors = React.useMemo(() => {
    return sectors.filter(s => s.branchId === selectedBranch);
  }, [sectors, selectedBranch]);

  // Actualizar la sucursal del nuevo sector al cambiar el selector principal
  const handleBranchChange = (bId: string) => {
    setSelectedBranch(bId);
    setNewSector(prev => ({ ...prev, branchId: bId }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createSector(newSector);
    setNewSector({
      branchId: selectedBranch,
      nombre: '',
      descripcion: '',
      activo: true
    });
    setShowAddModal(false);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSector) return;
    updateSector(editingSector.id, editingSector);
    setEditingSector(null);
  };

  const getSectorStaffCount = (sectorId: string) => {
    return users.filter(u => u.sectorId === sectorId).length;
  };

  return (
    <div>
      <div className="flex align-center justify-between" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Gestión de Sectores</h1>
          <p className="page-desc">Configurar divisiones operativas y asignar responsabilidades internas por sucursal</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          ➕ Nuevo Sector
        </button>
      </div>

      {/* Selector de Sucursal para filtrar sectores */}
      <div className="card-wrapper" style={{ padding: '16px 24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Filtrar sucursal:</span>
        <select 
          className="form-select" 
          value={selectedBranch}
          onChange={e => handleBranchChange(e.target.value)}
          style={{ width: '250px' }}
        >
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.nombre}</option>
          ))}
        </select>
      </div>

      <div className="card-wrapper">
        <div className="card-header">
          <h2 className="card-title">Sectores de {getBranchName(selectedBranch)}</h2>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {filteredSectors.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-disabled)' }}>
              No hay sectores registrados en esta sucursal.
            </div>
          ) : (
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Sector</th>
                    <th>Descripción</th>
                    <th>Personal Asignado</th>
                    <th>Estado</th>
                    <th className="text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSectors.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 'bold' }}>{s.nombre}</td>
                      <td>{s.descripcion || '-'}</td>
                      <td>
                        <span className="badge badge-info">
                          👥 {getSectorStaffCount(s.id)} empleados
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${s.activo ? 'badge-success' : 'badge-error'}`}>
                          {s.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="text-right">
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => setEditingSector(s)}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal para Crear */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <form onSubmit={handleCreate}>
              <div className="modal-header">
                <h2 className="card-title">Crear Nuevo Sector</h2>
                <button type="button" onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Sucursal</label>
                  <select 
                    className="form-select"
                    value={newSector.branchId}
                    onChange={e => setNewSector({ ...newSector, branchId: e.target.value })}
                    required
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Nombre del Sector</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newSector.nombre}
                    onChange={e => setNewSector({ ...newSector, nombre: e.target.value })}
                    placeholder="Ej: Logística, Calidad, Atención Telefónica"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Responsabilidades / Descripción</label>
                  <textarea 
                    className="form-textarea" 
                    value={newSector.descripcion}
                    onChange={e => setNewSector({ ...newSector, descripcion: e.target.value })}
                    placeholder="Detallar qué tareas realiza el sector..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-success">Crear Sector</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Editar */}
      {editingSector && (
        <div className="modal-overlay">
          <div className="modal-content">
            <form onSubmit={handleUpdate}>
              <div className="modal-header">
                <h2 className="card-title">Editar Sector</h2>
                <button type="button" onClick={() => setEditingSector(null)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Nombre del Sector</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editingSector.nombre}
                      onChange={e => setEditingSector({ ...editingSector, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select 
                      className="form-select"
                      value={editingSector.activo ? 'true' : 'false'}
                      onChange={e => setEditingSector({ ...editingSector, activo: e.target.value === 'true' })}
                    >
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">Responsabilidades / Descripción</label>
                  <textarea 
                    className="form-textarea" 
                    value={editingSector.descripcion || ''}
                    onChange={e => setEditingSector({ ...editingSector, descripcion: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingSector(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
