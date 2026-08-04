import React, { useState, useMemo } from 'react';
import { useAdminStore } from '../store/adminStore';
import type { InternalUser, UserRole } from '@shared/types/user';


export function UsersView() {
  const { users, branches, sectors, activeBranchId, createUser, updateUser, deleteUser } = useAdminStore();

  const handleDeleteClick = (id: string, nombre: string) => {
    setDeleteConfirmUser({ id, nombre, step: 1 });
  };

  const handleConfirmDeleteStep1 = () => {
    if (!deleteConfirmUser) return;
    setDeleteConfirmUser({ ...deleteConfirmUser, step: 2 });
  };

  const handleConfirmDeleteFinal = async () => {
    if (!deleteConfirmUser) return;
    await deleteUser(deleteConfirmUser.id);
    setDeleteConfirmUser(null);
  };

  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<{ id: string; nombre: string; step: 1 | 2 } | null>(null);

  // Form State
  const [formUser, setFormUser] = useState({
    nombre: '',
    email: '',
    rol: 'ventas' as UserRole,
    branchId: 'branch-gd1',
    sectorId: 'sector-gd1-adm',
    telefono: '',
    activo: true,
    password: '',
    auto: '',
    patente: '',
    fotoUrl: '',
    dni: '',
  });

  const roles = [
    { value: 'admin', label: 'Administrador General' },
    { value: 'encargado_sucursal', label: 'Encargado de Sucursal' },
    { value: 'ventas', label: 'Vendedor / Facturador' },
    { value: 'deposito', label: 'Personal de Depósito' },
    { value: 'repartidor', label: 'Chofer / Repartidor' },
    { value: 'caja', label: 'Cajero / Tesorero' },
    { value: 'solo_lectura', label: 'Solo Lectura' },
  ];

  const getRoleLabel = (role: UserRole) => {
    return roles.find(r => r.value === role)?.label || role;
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return '#ef4444'; // Red
      case 'encargado_sucursal': return '#eab308'; // Yellow
      case 'ventas': return '#3b82f6'; // Blue
      case 'deposito': return '#f97316'; // Orange
      case 'repartidor': return '#10b981'; // Green
      case 'caja': return '#8b5cf6'; // Purple
      default: return '#64748b'; // Gray
    }
  };

  const getBranchName = (bId?: string) => {
    if (!bId) return 'Global (Todas)';
    const b = branches.find(item => item.id === bId);
    return b ? b.nombre : 'Sin sucursal';
  };

  const getSectorName = (sId?: string) => {
    if (!sId) return 'General';
    const s = sectors.find(item => item.id === sId);
    return s ? s.nombre : 'Sin sector';
  };

  // Filtered staff list
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const query = search.toLowerCase();
      const matchesSearch = 
        u.nombre.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        (u.telefono && u.telefono.includes(query));

      const globalBranchFilter = activeBranchId === 'all' || u.branchId === activeBranchId || !u.branchId;
      const matchesRole = selectedRole === 'all' || u.rol === selectedRole;

      return matchesSearch && globalBranchFilter && matchesRole;
    });
  }, [users, search, activeBranchId, selectedRole]);

  // Sectors filtered by the selected branch in form
  const formSectors = useMemo(() => {
    if (!formUser.branchId) return [];
    return sectors.filter(s => s.branchId === formUser.branchId);
  }, [sectors, formUser.branchId]);

  const handleOpenEdit = (u: InternalUser) => {
    setEditingUser(u);
    setFormUser({
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      branchId: u.branchId || '',
      sectorId: u.sectorId || '',
      telefono: u.telefono || '',
      activo: u.activo,
      password: '',
      auto: u.auto || '',
      patente: u.patente || '',
      fotoUrl: u.fotoUrl || '',
      dni: u.dni || '',
    });
  };

  const handleOpenCreate = () => {
    setIsCreating(true);
    const defaultBranch = activeBranchId !== 'all' ? activeBranchId : (branches[0]?.id || 'branch-gd1');
    const branchSectors = sectors.filter(s => s.branchId === defaultBranch);
    setFormUser({
      nombre: '',
      email: '',
      rol: 'repartidor',
      branchId: defaultBranch,
      sectorId: branchSectors[0]?.id || '',
      telefono: '',
      activo: true,
      password: '',
      auto: '',
      patente: '',
      fotoUrl: '',
      dni: '',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const updates: any = {
      ...formUser,
      branchId: formUser.branchId || undefined,
      sectorId: formUser.sectorId || undefined,
    };
    
    // Si no ingresaron nueva contraseña, la removemos para no pisarla con vacío en la BD
    if (!formUser.password || formUser.password.trim() === '') {
      delete updates.password;
    }

    updateUser(editingUser.id, updates);
    setEditingUser(null);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createUser({
      ...formUser,
      branchId: formUser.branchId || undefined,
      sectorId: formUser.sectorId || undefined,
    });
    setIsCreating(false);
  };

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Personal e Internos</h1>
          <p className="page-desc">Administrar accesos de colaboradores, asignar roles operativos y sectorizar tareas</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          ➕ Registrar Colaborador
        </button>
      </div>

      {/* Filtros */}
      <div className="card-wrapper" style={{ marginBottom: '20px', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar por nombre, correo electrónico o teléfono..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ width: '200px' }}>
            <select 
              className="form-select"
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
            >
              <option value="all">Todos los roles</option>
              {roles.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
            Personal asignado: <strong>{filteredUsers.length}</strong> personas
          </div>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="card-wrapper">
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo Electrónico</th>
                <th>Rol Asignado</th>
                <th>Sucursal de Base</th>
                <th>Sector Asignado</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 'bold' }}>{u.nombre}</td>
                  <td>{u.email}</td>
                  <td>
                    <span 
                      className="badge" 
                      style={{ 
                        backgroundColor: getRoleColor(u.rol), 
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}
                    >
                      {getRoleLabel(u.rol)}
                    </span>
                  </td>
                  <td>{getBranchName(u.branchId)}</td>
                  <td>{getSectorName(u.sectorId)}</td>
                  <td>{u.telefono || '-'}</td>
                  <td>
                    <span className={`badge ${u.activo ? 'badge-success' : 'badge-error'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="text-right" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary" onClick={() => handleOpenEdit(u)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                      ✏️ Editar
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => handleDeleteClick(u.id, u.nombre)} 
                      style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      🗑️ Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-disabled)' }}>
                    No se encontraron colaboradores con los filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editar */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-header">
                <h2 className="card-title">Editar Colaborador</h2>
                <button type="button" className="btn-close" onClick={() => setEditingUser(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre Completo</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formUser.nombre}
                      onChange={e => setFormUser({ ...formUser, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Correo de Acceso (Usuario)</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      value={formUser.email}
                      onChange={e => setFormUser({ ...formUser, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Rol Operativo</label>
                    <select 
                      className="form-select"
                      value={formUser.rol}
                      onChange={e => setFormUser({ ...formUser, rol: e.target.value as UserRole })}
                    >
                      {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sucursal de Operación</label>
                    <select 
                      className="form-select"
                      value={formUser.branchId}
                      onChange={e => {
                        const bId = e.target.value;
                        const branchSectors = sectors.filter(s => s.branchId === bId);
                        setFormUser({ 
                          ...formUser, 
                          branchId: bId, 
                          sectorId: branchSectors[0]?.id || '' 
                        });
                      }}
                    >
                      <option value="">Global (Todas las sucursales)</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Sector Físico</label>
                    <select 
                      className="form-select"
                      value={formUser.sectorId}
                      onChange={e => setFormUser({ ...formUser, sectorId: e.target.value })}
                      disabled={!formUser.branchId}
                    >
                      <option value="">Sin Asignar / Administración</option>
                      {formSectors.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono Interno / Celular</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={formUser.telefono}
                      onChange={e => setFormUser({ ...formUser, telefono: e.target.value })}
                    />
                  </div>
                </div>

                {formUser.rol === 'repartidor' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '12px' }}>Datos específicos del Chofer</h3>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">Vehículo (Auto)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Ej: Ford Transit"
                          value={formUser.auto}
                          onChange={e => setFormUser({ ...formUser, auto: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Patente</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Ej: AB123CD"
                          value={formUser.patente}
                          onChange={e => setFormUser({ ...formUser, patente: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">DNI</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Ej: 35999888"
                          value={formUser.dni}
                          onChange={e => setFormUser({ ...formUser, dni: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">URL Foto del Chofer</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="https://..."
                          value={formUser.fotoUrl}
                          onChange={e => setFormUser({ ...formUser, fotoUrl: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Restablecer Contraseña (dejar vacío para mantener actual)</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Escribí la nueva contraseña..."
                    value={formUser.password || ''}
                    onChange={e => setFormUser({ ...formUser, password: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Habilitación de Cuenta</label>
                  <select 
                    className="form-select"
                    value={formUser.activo ? 'true' : 'false'}
                    onChange={e => setFormUser({ ...formUser, activo: e.target.value === 'true' })}
                  >
                    <option value="true">Activo (Habilitado para ingresar)</option>
                    <option value="false">Bloqueado / Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear */}
      {isCreating && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <form onSubmit={handleSaveCreate}>
              <div className="modal-header">
                <h2 className="card-title">Registrar Nuevo Colaborador</h2>
                <button type="button" className="btn-close" onClick={() => setIsCreating(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Nombre Completo</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: Marcelo Gómez"
                      value={formUser.nombre}
                      onChange={e => setFormUser({ ...formUser, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Correo de Acceso (Usuario)</label>
                    <input 
                      type="email" 
                      className="form-input" 
                      placeholder="ejemplo@quimica.com"
                      value={formUser.email}
                      onChange={e => setFormUser({ ...formUser, email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Rol Operativo</label>
                    <select 
                      className="form-select"
                      value={formUser.rol}
                      onChange={e => setFormUser({ ...formUser, rol: e.target.value as UserRole })}
                    >
                      {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sucursal de Operación</label>
                    <select 
                      className="form-select"
                      value={formUser.branchId}
                      onChange={e => {
                        const bId = e.target.value;
                        const branchSectors = sectors.filter(s => s.branchId === bId);
                        setFormUser({ 
                          ...formUser, 
                          branchId: bId, 
                          sectorId: branchSectors[0]?.id || '' 
                        });
                      }}
                    >
                      <option value="">Global (Todas las sucursales)</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Sector Físico</label>
                    <select 
                      className="form-select"
                      value={formUser.sectorId}
                      onChange={e => setFormUser({ ...formUser, sectorId: e.target.value })}
                      disabled={!formUser.branchId}
                    >
                      <option value="">Sin Asignar / Administración</option>
                      {formSectors.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Teléfono Interno / Celular</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej: 3584998877"
                      value={formUser.telefono}
                      onChange={e => setFormUser({ ...formUser, telefono: e.target.value })}
                    />
                  </div>
                </div>

                {formUser.rol === 'repartidor' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '12px' }}>Datos específicos del Chofer</h3>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">Vehículo (Auto)</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Ej: Ford Transit"
                          value={formUser.auto}
                          onChange={e => setFormUser({ ...formUser, auto: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Patente</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Ej: AB123CD"
                          value={formUser.patente}
                          onChange={e => setFormUser({ ...formUser, patente: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label className="form-label">DNI</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="Ej: 35999888"
                          value={formUser.dni}
                          onChange={e => setFormUser({ ...formUser, dni: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">URL Foto del Chofer</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="https://..."
                          value={formUser.fotoUrl}
                          onChange={e => setFormUser({ ...formUser, fotoUrl: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Contraseña de Ingreso *</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Escribí la contraseña de ingreso..."
                    value={formUser.password || ''}
                    onChange={e => setFormUser({ ...formUser, password: e.target.value })}
                    required
                  />
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreating(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Eliminación (Doble Confirmación) */}
      {deleteConfirmUser && (
        <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', zIndex: 99999 }}>
          <div className="modal-content" style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '450px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: '0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title" style={{ color: '#ef4444', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                {deleteConfirmUser.step === 1 ? '⚠️ Confirmación de Eliminación' : '🛑 Confirmación Definitiva'}
              </h2>
            </div>
            
            <div className="modal-body" style={{ margin: '16px 0' }}>
              {deleteConfirmUser.step === 1 ? (
                <p style={{ fontSize: '14px', color: '#334155', lineHeight: '22px', margin: 0 }}>
                  ¿Estás seguro de que deseas eliminar a <strong>{deleteConfirmUser.nombre}</strong>? 
                  Esta acción inhabilitará su acceso al sistema.
                </p>
              ) : (
                <p style={{ fontSize: '14px', color: '#991b1b', fontWeight: '500', lineHeight: '22px', backgroundColor: '#fee2e2', padding: '12px', borderRadius: '6px', border: '1px solid #fecaca', margin: 0 }}>
                  <strong>ATENCIÓN:</strong> Esta acción marcará permanentemente al colaborador como eliminado de la base de datos y no se podrá deshacer. ¿Confirmar la baja definitiva de <strong>{deleteConfirmUser.nombre}</strong>?
                </p>
              )}
            </div>

            <div className="modal-footer" style={{ borderTop: 'none', paddingTop: '10px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: 'pointer', backgroundColor: '#fff' }}
                onClick={() => setDeleteConfirmUser(null)}
              >
                Cancelar
              </button>
              {deleteConfirmUser.step === 1 ? (
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#ef4444', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
                  onClick={handleConfirmDeleteStep1}
                >
                  Sí, continuar
                </button>
              ) : (
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  style={{ padding: '8px 16px', borderRadius: '4px', border: 'none', backgroundColor: '#991b1b', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
                  onClick={handleConfirmDeleteFinal}
                >
                  Confirmar baja definitiva
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
