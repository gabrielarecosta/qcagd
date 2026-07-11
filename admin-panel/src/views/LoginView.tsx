import React, { useState } from 'react';
import { useAdminStore } from '../store/adminStore';
import logoImg from '../assets/logo2.png';

export function LoginView() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { users, setCurrentUser } = useAdminStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Por favor complete todos los campos');
      return;
    }

    setError('');
    setIsLoading(true);

    // Simulate minor lag for visual transitions & realistic authorization check
    setTimeout(() => {
      const normalizedUser = username.trim().toLowerCase();
      if (normalizedUser === 'qca' && password === 'qca') {
        const adminUser = users.find(u => u.rol === 'admin') || users[0] || {
          id: 'usr-gabriel',
          email: 'admin@quimicadeheza.com',
          nombre: 'Gabriel Areco (Local Fallback)',
          rol: 'admin',
          branchId: 'branch-gd1',
          activo: true,
        };
        setCurrentUser(adminUser);
      } else {
        setError('Credenciales inválidas. Verifique usuario y contraseña.');
        setIsLoading(false);
      }
    }, 700);
  };

  return (
    <div className="login-page-container">
      <style>{`
        .login-page-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at center, #1e293b 0%, #0f172a 100%);
          font-family: var(--sans-font);
          padding: 20px;
          z-index: 9999;
          overflow-y: auto;
        }

        .login-card {
          width: 100%;
          max-width: 440px;
          background: rgba(30, 41, 59, 0.75);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 
                      0 0 40px rgba(14, 165, 233, 0.15);
          text-align: center;
          box-sizing: border-box;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .login-logo-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 96px;
          height: 96px;
          background: #ffffff;
          border-radius: 20px;
          padding: 12px;
          box-sizing: border-box;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25),
                      0 0 15px rgba(14, 165, 233, 0.2);
          margin-bottom: 24px;
          transition: transform 0.3s ease;
        }

        .login-logo-wrapper:hover {
          transform: scale(1.05) rotate(2deg);
        }

        .login-logo {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .login-title {
          color: #ffffff;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 1.5px;
          line-height: 1.5;
          margin: 0 0 32px 0;
          text-transform: uppercase;
          background: linear-gradient(135deg, #ffffff 50%, #bae6fd 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .login-form {
          text-align: left;
        }

        .form-group {
          margin-bottom: 20px;
          position: relative;
        }

        .form-label {
          display: block;
          color: #94a3b8;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
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

        .login-input {
          width: 100%;
          padding: 13px 16px 13px 44px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #ffffff;
          font-size: 14px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
        }

        .login-input:focus {
          outline: none;
          border-color: var(--accent-color);
          background: rgba(15, 23, 42, 0.85);
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
        }

        .password-toggle {
          position: absolute;
          right: 14px;
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s;
        }

        .password-toggle:hover {
          color: #ffffff;
        }

        .error-message {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 12px;
          color: #fca5a5;
          font-size: 13px;
          padding: 12px 16px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          animation: shake 0.4s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }

        .login-btn {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
          color: #ffffff;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);
        }

        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(14, 165, 233, 0.4);
          background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
        }

        .login-btn:active:not(:disabled) {
          transform: translateY(1px);
        }

        .login-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: #ffffff;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .login-footer-text {
          margin-top: 32px;
          color: #64748b;
          font-size: 12px;
          letter-spacing: 0.5px;
        }
      `}</style>

      <div className="login-card">
        <div className="login-logo-wrapper">
          <img src={logoImg} className="login-logo" alt="QGD Logo" />
        </div>

        <h1 className="login-title">
          ACCESO A PANEL ADMINISTRATIVO DE QGD APP MOBILE
        </h1>

        {error && (
          <div className="error-message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Usuario</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                type="text"
                className="login-input"
                placeholder="Ingrese usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '32px' }}>
            <label className="form-label">Contraseña</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                placeholder="Ingrese contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <span className="spinner" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <span>Ingresar al Sistema</span>
            )}
          </button>
        </form>

        <div className="login-footer-text">
          QUÍMICA DEHEZA © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
