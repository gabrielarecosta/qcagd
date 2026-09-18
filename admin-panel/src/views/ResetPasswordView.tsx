import React, { useState, useEffect } from 'react';
import logoImg from '../assets/logo2.png';
import { supabase } from '@shared/services/supabaseClient';

interface ResetPasswordViewProps {
  onSuccess?: () => void;
}

export function ResetPasswordView({ onSuccess }: ResetPasswordViewProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hasValidToken, setHasValidToken] = useState(true);

  useEffect(() => {
    // Escuchar eventos de Supabase Auth para capturar PASSWORD_RECOVERY
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasValidToken(true);
      }
    });

    // Verificar si en la URL viene el hash de token de recuperación
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash.includes('error') || search.includes('error')) {
      const params = new URLSearchParams(hash.replace('#', '?') || search);
      setError(params.get('error_description') || 'El enlace de recuperación ha expirado o no es válido.');
      setHasValidToken(false);
    }

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.trim().length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor verifique.');
      return;
    }

    setError('');
    setIsLoading(true);
    setSuccessMessage('');

    try {
      // 1. Intentar actualizar contraseña vía Supabase Auth nativo
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword.trim(),
      });

      if (updateErr) {
        // Fallback: Si no hay sesión válida o token expiró, intentar vía RPC si está logueado
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user?.id) {
          const { error: rpcErr } = await supabase.rpc('update_user_password', {
            target_user_id: sessionData.session.user.id,
            new_password: newPassword.trim(),
          });
          if (rpcErr) throw rpcErr;
        } else {
          throw updateErr;
        }
      }

      setSuccessMessage('¡Tu contraseña ha sido actualizada correctamente! Ya puedes ingresar con tu nueva clave.');
      
      // Limpiar hash de la URL
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 2500);
    } catch (err: any) {
      console.error('Error al actualizar contraseña:', err);
      setError(err.message || 'No se pudo actualizar la contraseña. Verifique que el enlace no haya expirado.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="reset-password-page-container">
      <style>{`
        .reset-password-page-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 20px;
          z-index: 9999;
        }

        .reset-card {
          width: 100%;
          max-width: 440px;
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          text-align: center;
        }

        .reset-logo {
          width: 72px;
          height: 72px;
          object-fit: cover;
          border-radius: 16px;
          margin-bottom: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .reset-title {
          color: #f8fafc;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin-bottom: 8px;
        }

        .reset-subtitle {
          color: #94a3b8;
          font-size: 13.5px;
          margin-bottom: 28px;
          line-height: 1.5;
        }

        .form-group {
          text-align: left;
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          color: #cbd5e1;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 8px;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .input-icon {
          position: absolute;
          left: 14px;
          color: #64748b;
          display: flex;
          align-items: center;
          pointer-events: none;
        }

        .reset-input {
          width: 100%;
          height: 46px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 0 44px 0 42px;
          color: #ffffff;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
        }

        .reset-input:focus {
          border-color: #38bdf8;
          background: rgba(15, 23, 42, 0.9);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
        }

        .password-toggle {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 4px;
        }

        .password-toggle:hover {
          color: #94a3b8;
        }

        .reset-btn {
          width: 100%;
          height: 48px;
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 14.5px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 10px;
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.3);
        }

        .reset-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(2, 132, 199, 0.4);
        }

        .reset-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .alert-box {
          padding: 12px 16px;
          border-radius: 12px;
          font-size: 13.5px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          text-align: left;
          line-height: 1.4;
        }

        .alert-error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .alert-success {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #86efac;
        }

        .back-link {
          display: inline-block;
          margin-top: 24px;
          color: #38bdf8;
          font-size: 13.5px;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.2s;
        }

        .back-link:hover {
          color: #7dd3fc;
          text-decoration: underline;
        }
      `}</style>

      <div className="reset-card">
        <img src={logoImg} className="reset-logo" alt="QGD Logo" />

        <h1 className="reset-title">Restablecer Contraseña</h1>
        <p className="reset-subtitle">
          Ingresa tu nueva contraseña para actualizar tu acceso al sistema.
        </p>

        {error && (
          <div className="alert-box alert-error">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert-box alert-success">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {successMessage ? (
          <button 
            type="button" 
            className="reset-btn" 
            onClick={() => onSuccess && onSuccess()}
          >
            Ir a Iniciar Sesión
          </button>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Nueva Contraseña</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="reset-input"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Ocultar" : "Mostrar"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="1" y1="1" x2="23" y2="23" />
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '28px' }}>
              <label className="form-label">Confirmar Nueva Contraseña</label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="reset-input"
                  placeholder="Repita la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <button type="submit" className="reset-btn" disabled={isLoading}>
              {isLoading ? (
                <span>Guardando cambios...</span>
              ) : (
                <span>Guardar Nueva Contraseña</span>
              )}
            </button>
          </form>
        )}

        <div style={{ marginTop: '20px' }}>
          <a
            className="back-link"
            onClick={() => {
              if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', window.location.pathname);
              }
              if (onSuccess) onSuccess();
            }}
          >
            ← Volver al Login
          </a>
        </div>
      </div>
    </div>
  );
}
