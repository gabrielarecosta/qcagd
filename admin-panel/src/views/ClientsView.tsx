import React, { useState, useMemo } from 'react';
import { useAdminStore } from '../store/adminStore';
import type { Customer, ClientType } from '@shared/types/client';
import * as XLSX from 'xlsx';
import { supabase } from '@shared/services/supabaseClient';

export function ClientsView() {
  const { clients, branches, updateClient, createClient, activeBranchId } = useAdminStore();
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [editingClient, setEditingClient] = useState<Customer | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [formClient, setFormClient] = useState({
    nombre: '',
    razonSocial: '',
    cuit: '',
    email: '',
    telefono: '',
    direccion: '',
    branchId: 'branch-gd1',
    tipoCliente: 'minorista' as ClientType,
    activo: true,
    observaciones: '',
    zona: 'General',
  });

  const handleOpenEdit = (c: Customer) => {
    setEditingClient(c);
    setFormClient({
      nombre: c.nombre || '',
      razonSocial: c.razonSocial || '',
      cuit: c.cuit || '',
      email: c.email || '',
      telefono: c.telefono || '',
      direccion: c.direccion || '',
      branchId: c.branchId,
      tipoCliente: c.tipoCliente,
      activo: c.activo,
      observaciones: c.observaciones || '',
      zona: c.zona || 'General',
    });
  };

  const handleOpenCreate = () => {
    setIsCreating(true);
    setFormClient({
      nombre: '',
      razonSocial: '',
      cuit: '',
      email: '',
      telefono: '',
      direccion: '',
      branchId: activeBranchId !== 'all' ? activeBranchId : 'branch-gd1',
      tipoCliente: 'minorista',
      activo: true,
      observaciones: '',
      zona: 'General',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    updateClient(editingClient.id, formClient);
    setEditingClient(null);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createClient(formClient);
    setIsCreating(false);
  };

  // Filtrado de Clientes
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      // Filtrado por barra de búsqueda
      const query = search.toLowerCase();
      const matchesSearch = 
        (c.nombre || '').toLowerCase().includes(query) ||
        (c.razonSocial || '').toLowerCase().includes(query) ||
        (c.cuit || '').includes(query) ||
        (c.direccion || '').toLowerCase().includes(query) ||
        (c.email || '').toLowerCase().includes(query);

      // Filtrado por sucursal activa globalmente y filtro de barra sucursal
      const globalBranchFilter = activeBranchId === 'all' || c.branchId === activeBranchId;
      const localBranchFilter = selectedBranch === 'all' || c.branchId === selectedBranch;

      // Filtrado por tipo (minorista/mayorista)
      const matchesType = selectedType === 'all' || c.tipoCliente === selectedType;

      return matchesSearch && globalBranchFilter && localBranchFilter && matchesType;
    });
  }, [clients, search, activeBranchId, selectedBranch, selectedType]);

  const getBranchName = (bId: string) => {
    const b = branches.find(item => item.id === bId);
    return b ? b.nombre : 'Sin sucursal';
  };

  const handleExportClients = () => {
    const dataToExport = filteredClients.map(c => ({
      Nombre: c.nombre,
      RazónSocial: c.razonSocial || '',
      CUIT: c.cuit || '',
      Teléfono: c.telefono,
      Email: c.email || '',
      Dirección: c.direccion,
      Zona: c.zona,
      Sucursal: getBranchName(c.branchId),
      Segmento: c.tipoCliente,
      Estado: c.activo ? 'Activo' : 'Suspendido',
      Observaciones: c.observaciones || '',
    }));

    const fileName = `clientes_export_${Date.now()}.xlsx`;
    const userEmail = useAdminStore.getState().currentUser?.email || 'admin@quimicadeheza.com';

    supabase
      .from('export_history')
      .insert({
        usuario: userEmail,
        tipo: 'clientes',
        filtros: { branchId: activeBranchId, search, selectedBranch, selectedType },
        cantidad_registros: dataToExport.length,
        nombre_archivo: fileName
      })
      .then(({ error }) => {
        if (error) console.error(error);
      });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Directorio de Clientes</h1>
          <p className="page-desc">Administrar cuentas, perfiles fiscales, asignaciones de sucursal y notas de reparto</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleExportClients}>
            📤 Exportar Excel
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            ➕ Registrar Cliente
          </button>
        </div>
      </div>

      {/* Controles de Búsqueda y Filtros */}
      <div className="card-wrapper" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar por CUIT, Razón Social, Dirección o Email..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {activeBranchId === 'all' && (
            <div style={{ width: '180px' }}>
              <select 
                className="form-select"
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
              >
                <option value="all">Todas las sucursales</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ width: '180px' }}>
            <select 
              className="form-select"
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
            >
              <option value="all">Todos los segmentos</option>
              <option value="minorista">Minorista</option>
              <option value="mayorista">Mayorista</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Encontrados: <strong>{filteredClients.length}</strong> clientes
          </div>
        </div>
      </div>

      {/* Tabla de Clientes */}
      <div className="card-wrapper">
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Razón Social / Nombre</th>
                <th>Contacto</th>
                <th>Dirección / Sucursal</th>
                <th>Segmento</th>
                <th>Notas Despacho</th>
                <th>Estado</th>
                <th className="text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 'bold' }}>{c.nombre}</div>
                    {c.razonSocial && <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.razonSocial}</div>}
                    {c.cuit && <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>CUIT: {c.cuit}</div>}
                  </td>
                  <td>
                    {c.email && <div style={{ fontSize: '13px' }}>✉️ {c.email}</div>}
                    <div style={{ fontSize: '13px' }}>📞 {c.telefono}</div>
                  </td>
                  <td>
                    <div>{c.direccion}</div>
                    <div style={{ fontSize: '11px', color: 'var(--accent-color)', fontWeight: 'bold' }}>📍 {getBranchName(c.branchId)}</div>
                  </td>
                  <td>
                    <span className={`badge ${c.tipoCliente === 'mayorista' ? 'badge-warning' : 'badge-neutral'}`}>
                      {c.tipoCliente.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ 
                      fontSize: '12px', 
                      color: 'var(--text-secondary)', 
                      maxWidth: '180px', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap' 
                    }} title={c.observaciones || 'Sin notas'}>
                      {c.observaciones || '-'}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${c.activo ? 'badge-success' : 'badge-error'}`}>
                      {c.activo ? 'Activo' : 'Suspendido'}
                    </span>
                  </td>
                  <td className="text-right">
                    <button className="btn btn-secondary" onClick={() => handleOpenEdit(c)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                      ✏️ Editar
                    </button>
                  </td>
                </tr>
              ))}
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                    Todavía no hay clientes registrados.
                  </td>
                </tr>
              ) : filteredClients.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                    No se encontraron clientes con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar Cliente */}
      {editingClient && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-header">
                <h2 className="card-title">Editar Cliente: {editingClient.nombre}</h2>
                <button type="button" className="btn-close" onClick={() => setEditingClient(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre Comercial / Titular</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formClient.nombre}
                      onChange={e => setFormClient({ ...formClient, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Razón Social (Opcional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formClient.razonSocial}
                      onChange={e => setFormClient({ ...formClient, razonSocial: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">CUIT (sólo números, Opcional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formClient.cuit}
                      onChange={e => setFormClient({ ...formClient, cuit: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono de contacto</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formClient.telefono}
                      onChange={e => setFormClient({ ...formClient, telefono: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Email (Opcional)</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={formClient.email}
                      onChange={e => setFormClient({ ...formClient, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dirección de Entrega</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formClient.direccion}
                      onChange={e => setFormClient({ ...formClient, direccion: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Sucursal de Atención</label>
                    <select 
                      className="form-select"
                      value={formClient.branchId}
                      onChange={e => setFormClient({ ...formClient, branchId: e.target.value })}
                    >
                      {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Segmento Comercial</label>
                    <select 
                      className="form-select"
                      value={formClient.tipoCliente}
                      onChange={e => setFormClient({ ...formClient, tipoCliente: e.target.value as ClientType })}
                    >
                      <option value="minorista">Minorista</option>
                      <option value="mayorista">Mayorista (Precios diferenciados)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado de la Cuenta</label>
                    <select 
                      className="form-select"
                      value={formClient.activo ? 'true' : 'false'}
                      onChange={e => setFormClient({ ...formClient, activo: e.target.value === 'true' })}
                    >
                      <option value="true">Activo / Habilitado</option>
                      <option value="false">Suspendido / En Mora</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Zona de Entrega</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formClient.zona}
                    onChange={e => setFormClient({ ...formClient, zona: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notas Especiales de Despacho / Observaciones</label>
                  <textarea 
                    className="form-input" 
                    style={{ height: '80px', fontFamily: 'sans-serif' }}
                    placeholder="Instrucciones para el repartidor (Ej: Entrar por calle lateral, el timbre no funciona)"
                    value={formClient.observaciones}
                    onChange={e => setFormClient({ ...formClient, observaciones: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingClient(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Registrar Cliente */}
      {isCreating && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <form onSubmit={handleSaveCreate}>
              <div className="modal-header">
                <h2 className="card-title">Registrar Nuevo Cliente</h2>
                <button type="button" className="btn-close" onClick={() => setIsCreating(false)}>✕</button>
              </div>
              <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre Comercial / Titular</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Marcelo Gómez"
                      value={formClient.nombre}
                      onChange={e => setFormClient({ ...formClient, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Razón Social (Opcional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Distribuidora Sol S.A."
                      value={formClient.razonSocial}
                      onChange={e => setFormClient({ ...formClient, razonSocial: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">CUIT (sólo números, Opcional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: 30123456789"
                      value={formClient.cuit}
                      onChange={e => setFormClient({ ...formClient, cuit: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono de contacto</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: 3584123456"
                      value={formClient.telefono}
                      onChange={e => setFormClient({ ...formClient, telefono: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Email (Opcional)</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      placeholder="ejemplo@correo.com"
                      value={formClient.email}
                      onChange={e => setFormClient({ ...formClient, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dirección de Entrega</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Bv. Belgrano 120, General Deheza"
                      value={formClient.direccion}
                      onChange={e => setFormClient({ ...formClient, direccion: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Sucursal de Atención</label>
                    <select 
                      className="form-select"
                      value={formClient.branchId}
                      onChange={e => setFormClient({ ...formClient, branchId: e.target.value })}
                    >
                      {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Segmento Comercial</label>
                    <select 
                      className="form-select"
                      value={formClient.tipoCliente}
                      onChange={e => setFormClient({ ...formClient, tipoCliente: e.target.value as ClientType })}
                    >
                      <option value="minorista">Minorista</option>
                      <option value="mayorista">Mayorista (Precios diferenciados)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Zona de Entrega</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={formClient.zona}
                    onChange={e => setFormClient({ ...formClient, zona: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notas Especiales / Observaciones</label>
                  <textarea 
                    className="form-input" 
                    style={{ height: '80px', fontFamily: 'sans-serif' }}
                    placeholder="Instrucciones del chofer al entregar."
                    value={formClient.observaciones}
                    onChange={e => setFormClient({ ...formClient, observaciones: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreating(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
