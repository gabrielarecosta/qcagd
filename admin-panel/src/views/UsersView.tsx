import React, { useState, useMemo } from 'react';
import { useAdminStore } from '../store/adminStore';
import type { InternalUser, UserRole } from '@shared/types/user';


export function UsersView() {
  const { users, branches, sectors, activeBranchId, createUser, updateUser } = useAdminStore();

  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [formUser, setFormUser] = useState({
    nombre: '',
    email: '',
    rol: 'ventas' as UserRole,
    branchId: 'branch-gd1',
    sectorId: 'sector-gd1-adm',
    telefono: '',
    activo: true,
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
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    updateUser(editingUser.id, {
      ...formUser,
      branchId: formUser.branchId || undefined,
      sectorId: formUser.sectorId || undefined,
    });
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
                  <td className="text-right">
                    <button className="btn btn-secondary" onClick={() => handleOpenEdit(u)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                      ✏️ Editar
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

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreating(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
