import React, { useState, useEffect } from 'react';
import { userService } from '@shared/services/userService';
import type { InternalUser } from '@shared/types/user';

export function SystemAdminView() {
  const [users, setUsers] = useState<InternalUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [manualUserSearch, setManualUserSearch] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await userService.getAll();
      setUsers(data);
    } catch (err: any) {
      console.error('Error cargando usuarios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const selectedUser = users.find(u => u.id === selectedUserId || u.email.toLowerCase() === manualUserSearch.trim().toLowerCase());

  const handleOverridePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    const targetId = selectedUserId || selectedUser?.id || manualUserSearch.trim();
    if (!targetId) {
      setMsg({ type: 'error', text: 'Por favor seleccioná un usuario del combo o ingresá un ID/Email.' });
      return;
    }

    if (!newPassword || newPassword.trim().length < 6) {
      setMsg({ type: 'error', text: 'La nueva contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Pisar contraseña mediante RPC
      await userService.adminUpdateUserPassword(targetId, newPassword.trim());

      // 2. Pisar email si fue especificado
      if (newEmail && newEmail.trim().includes('@')) {
        await userService.updateOwnProfile(targetId, { email: newEmail.trim() });
      }

      setMsg({ type: 'success', text: `✅ ¡Contraseña pisada exitosamente para el usuario ${selectedUser?.nombre || targetId}!` });
      setNewPassword('');
      setNewEmail('');
      loadUsers();
    } catch (err: any) {
      console.error('Error pisando contraseña:', err);
      setMsg({ type: 'error', text: 'Ocurrió un error al pisar la contraseña: ' + (err.message || String(err)) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickOverride = async (user: InternalUser) => {
    const pw = window.prompt(`Escribí la nueva contraseña para pisar a ${user.nombre} (${user.email}):`, 'Quimica2026!');
    if (!pw || pw.trim().length < 6) {
      if (pw !== null) alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      await userService.adminUpdateUserPassword(user.id, pw.trim());
      alert(`✅ Se pisó la contraseña de ${user.nombre} correctamente.`);
      loadUsers();
    } catch (err: any) {
      alert('Error al pisar contraseña: ' + (err.message || String(err)));
    }
  };

  return (
    <div className="view-container">
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0, color: '#ef4444' }}>⚡ SuperAdmin - Administrador del Sistema</h1>
            <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase' }}>
              HERRAMIENTA INDEPENDIENTE
            </span>
          </div>
          <p className="page-desc" style={{ marginTop: '4px' }}>
            Herramienta de nivel sistema para pisar contraseñas y credenciales de cualquier usuario o administrador sin restricciones del panel del negocio.
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={loadUsers} 
          disabled={isLoading}
          style={{ padding: '8px 16px', background: '#1e293b', color: '#38bdf8', border: '1px solid #334155' }}
        >
          🔄 {isLoading ? 'Cargando...' : 'Recargar Usuarios'}
        </button>
      </div>

      {msg && (
        <div style={{
          padding: '14px',
          borderRadius: '8px',
          marginBottom: '20px',
          backgroundColor: msg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${msg.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: msg.type === 'success' ? '#6ee7b7' : '#fca5a5',
          fontSize: '14px',
          fontWeight: '600'
        }}>
          {msg.text}
        </div>
      )}

      {/* Formulario Principal de Pisar Contraseña */}
      <div className="card-wrapper" style={{ marginBottom: '28px', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#38bdf8', marginTop: 0, marginBottom: '16px' }}>
          🔑 Formulario para Pisar Contraseña por Usuario
        </h2>

        <form onSubmit={handleOverridePassword}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {/* Combo Box / Selector de Usuario */}
            <div className="form-group">
              <label className="form-label" style={{ color: '#f8fafc', fontWeight: 'bold' }}>
                1. Seleccionar Usuario desde Combo / Desplegable:
              </label>
              <select
                className="form-select"
                value={selectedUserId}
                onChange={e => {
                  setSelectedUserId(e.target.value);
                  setManualUserSearch('');
                }}
                style={{ background: '#0f172a', color: '#fff', borderColor: '#334155', padding: '10px' }}
              >
                <option value="">-- Seleccioná un usuario ({users.length}) --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} | {u.email} ({u.rol})
                  </option>
                ))}
              </select>
            </div>

            {/* Búsqueda manual de ID / Email */}
            <div className="form-group">
              <label className="form-label" style={{ color: '#cbd5e1' }}>
                O ingresar Usuario ID / Email manualmente:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="UUID o email exacto..."
                value={manualUserSearch}
                onChange={e => {
                  setManualUserSearch(e.target.value);
                  setSelectedUserId('');
                }}
                style={{ background: '#0f172a', color: '#fff', borderColor: '#334155', padding: '10px' }}
              />
            </div>
          </div>

          {/* Tarjeta de Resumen de Usuario Seleccionado */}
          {selectedUser && (
            <div style={{ background: '#0f172a', border: '1px solid #0284c7', borderRadius: '8px', padding: '14px', marginBottom: '16px', fontSize: '13px', color: '#e2e8f0' }}>
              <div style={{ color: '#38bdf8', fontWeight: 'bold', marginBottom: '4px' }}>👤 Usuario Seleccionado:</div>
              <div><b>ID:</b> <code style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>{selectedUser.id}</code></div>
              <div><b>Nombre:</b> {selectedUser.nombre} | <b>Email Actual:</b> {selectedUser.email}</div>
              <div><b>Rol:</b> {selectedUser.rol} | <b>Sucursal ID:</b> {selectedUser.branchId || 1}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            {/* Nueva Contraseña */}
            <div className="form-group">
              <label className="form-label" style={{ color: '#f8fafc', fontWeight: 'bold' }}>
                2. Nueva Contraseña a Pisar:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Escribí la nueva contraseña..."
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                style={{ background: '#0f172a', color: '#fff', borderColor: '#ef4444', padding: '10px' }}
              />
            </div>

            {/* Nuevo Email / Usuario (Opcional) */}
            <div className="form-group">
              <label className="form-label" style={{ color: '#cbd5e1' }}>
                3. Nuevo Email / Usuario a Pisar (opcional):
              </label>
              <input
                type="email"
                className="form-input"
                placeholder="nuevoemail@quimica.com..."
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                style={{ background: '#0f172a', color: '#fff', borderColor: '#334155', padding: '10px' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn"
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '15px',
              cursor: 'pointer',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? 'Pisando Contraseña...' : '⚡ PISAR CONTRASENA Y CREDENCIALES'}
          </button>
        </form>
      </div>

      {/* Tabla de Todos los Usuarios del Sistema con Acción Rápida */}
      <div className="card-wrapper" style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 'bold', color: '#f8fafc', marginTop: 0, marginBottom: '16px' }}>
          📋 Lista General de Cuentas de Usuario en el Sistema ({users.length})
        </h2>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', color: '#f8fafc' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left', fontSize: '12px' }}>
                <th style={{ padding: '10px' }}>Usuario / Nombre</th>
                <th style={{ padding: '10px' }}>Email</th>
                <th style={{ padding: '10px' }}>Rol</th>
                <th style={{ padding: '10px' }}>ID Usuario</th>
                <th style={{ padding: '10px', textAlign: 'right' }}>Acción Rápida</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #334155', fontSize: '13px' }}>
                  <td style={{ padding: '10px', fontWeight: '600' }}>{u.nombre}</td>
                  <td style={{ padding: '10px', color: '#38bdf8' }}>{u.email}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#334155', fontSize: '11px', textTransform: 'uppercase' }}>
                      {u.rol}
                    </span>
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>{u.id}</td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => handleQuickOverride(u)}
                      style={{
                        padding: '6px 12px',
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      ⚡ Pisar Clave
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
