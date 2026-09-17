import React, { useState, useEffect } from 'react';
import { userService } from '@shared/services/userService';
import type { InternalUser } from '@shared/types/user';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: InternalUser | null;
  onUserUpdated?: (updatedUser: InternalUser) => void;
}

export function ChangePasswordModal({ isOpen, onClose, currentUser, onUserUpdated }: ChangePasswordModalProps) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setEmail(currentUser.email || '');
      setNombre(currentUser.nombre || '');
    }
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailTrimmed = email.trim().toLowerCase();
    const nombreTrimmed = nombre.trim();
    const hasPasswordChange = newPassword.trim().length > 0;

    if (!emailTrimmed || !emailTrimmed.includes('@')) {
      setErrorMsg('Por favor ingresá un email o usuario válido.');
      return;
    }

    if (hasPasswordChange) {
      if (newPassword.trim().length < 6) {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('Las contraseñas no coinciden.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const userId = currentUser?.id || '1';

      // 1. Cambiar contraseña si ingresaron una
      if (hasPasswordChange) {
        await userService.changeOwnPassword(newPassword.trim());
      }

      // 2. Cambiar email / nombre si se modificó
      if (emailTrimmed !== currentUser?.email?.toLowerCase() || nombreTrimmed !== currentUser?.nombre) {
        await userService.updateOwnProfile(userId, {
          email: emailTrimmed,
          nombre: nombreTrimmed
        });
      }

      const updatedUser: InternalUser = {
        ...currentUser,
        id: userId,
        email: emailTrimmed,
        nombre: nombreTrimmed || currentUser?.nombre || 'Administrador',
        rol: currentUser?.rol || 'admin',
        activo: true
      };

      if (onUserUpdated) {
        onUserUpdated(updatedUser);
      }

      setSuccessMsg('✅ ¡Datos de usuario y contraseña actualizados correctamente!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1600);
    } catch (err: any) {
      console.error('Error al actualizar datos de usuario/contraseña:', err);
      setErrorMsg(err.message || 'Ocurrió un error al intentar actualizar los datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPasswordStrength = (pw: string) => {
    if (!pw) return { label: '', color: '#334155', percent: 0 };
    if (pw.length < 6) return { label: 'Insegura (Mínimo 6 caracteres)', color: '#ef4444', percent: 25 };
    const hasLetters = /[a-zA-Z]/.test(pw);
    const hasNumbers = /[0-9]/.test(pw);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pw);

    if (pw.length >= 8 && hasLetters && hasNumbers && hasSpecial) {
      return { label: 'Excelente 🔒', color: '#10b981', percent: 100 };
    }
    if (pw.length >= 6 && hasLetters && hasNumbers) {
      return { label: 'Buena 👍', color: '#38bdf8', percent: 70 };
    }
    return { label: 'Aceptable ⚠️', color: '#f59e0b', percent: 45 };
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: '28px',
        maxWidth: '460px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
        position: 'relative'
      }}>
        {/* Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '24px' }}>👤</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#f8fafc' }}>Configuración de Mi Cuenta / Admin</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>Cambiar usuario, email y contraseña</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1
            }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#fca5a5',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#6ee7b7',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '16px'
          }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Nombre */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: '500' }}>
              Nombre de Usuario / Administrador
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Administrador General"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Email / Usuario */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: '500' }}>
              Email de Acceso (Usuario Administrador)
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@quimicadeheza.com"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ borderTop: '1px solid #334155', margin: '18px 0 14px 0' }} />

          {/* Nueva Contraseña */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: '500' }}>
              Nueva Contraseña <span style={{ fontSize: '11px', color: '#94a3b8' }}>(dejar vacío para mantener la actual)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Ingresá al menos 6 caracteres"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {/* Barra de fortaleza */}
            {newPassword.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ height: '4px', background: '#334155', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${strength.percent}%`,
                    background: strength.color,
                    transition: 'all 0.3s ease'
                  }} />
                </div>
                <div style={{ fontSize: '11px', color: strength.color, marginTop: '4px', fontWeight: '600' }}>
                  {strength.label}
                </div>
              </div>
            )}
          </div>

          {/* Confirmar Contraseña */}
          {newPassword.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#cbd5e1', marginBottom: '6px', fontWeight: '500' }}>
                Confirmar Nueva Contraseña
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repetí la nueva contraseña"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          {/* Botones */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '10px 16px',
                background: '#334155',
                color: '#cbd5e1',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              {isSubmitting ? 'Guardando...' : '💾 Guardar Datos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
