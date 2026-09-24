import React, { useState } from 'react';
import { useAutoUpdate } from '../hooks/useAutoUpdate';

interface AdminSidebarVersionProps {
  collapsed?: boolean;
}

export const AdminSidebarVersion: React.FC<AdminSidebarVersionProps> = ({ collapsed = false }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  const {
    currentVersion,
    latestVersion,
    history,
    isChecking,
    hasUpdate,
    isReloading,
    blockedByLoopProtection,
    lastChecked,
    checkVersion,
    forceUpdateNow,
  } = useAutoUpdate();

  const isUpToDate = !hasUpdate;

  // Si el sidebar está colapsado, mostrar un icono interactivo compacto
  if (collapsed) {
    return (
      <>
        <div
          style={{
            padding: '12px 0',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button
            onClick={() => setShowHistoryModal(true)}
            title={`Versión v${currentVersion} (Click para ver historial)`}
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '16px' }}>🏷️</span>
            <span
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isUpToDate ? '#10b981' : '#f59e0b',
                boxShadow: '0 0 0 2px #0f172a',
              }}
            />
          </button>
        </div>

        {/* Modal de Historial */}
        {showHistoryModal && renderHistoryModal()}
      </>
    );
  }

  function renderHistoryModal() {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}
        onClick={() => setShowHistoryModal(false)}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '680px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh',
            animation: 'fadeIn 0.2s ease',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>🚀</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                  Historial de Versiones del Sistema
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Versión activa: <strong>v{currentVersion}</strong> · Servidor: <strong>v{latestVersion}</strong>
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowHistoryModal(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '18px',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
            >
              ✕
            </button>
          </div>

          {/* Modal Body */}
          <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
            <div
              style={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, width: '110px' }}>Versión</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, width: '110px' }}>Fecha</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700 }}>Cambios y Novedades</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, width: '110px' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        Cargando historial de versiones...
                      </td>
                    </tr>
                  ) : (
                    history.map((item, idx) => {
                      const isItemCurrent = item.version === currentVersion;
                      const isItemLatest = item.version === latestVersion;

                      return (
                        <tr
                          key={item.version || idx}
                          style={{
                            borderBottom: idx < history.length - 1 ? '1px solid #f1f5f9' : 'none',
                            backgroundColor: isItemCurrent ? 'rgba(16, 185, 129, 0.05)' : undefined,
                          }}
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                backgroundColor: '#f1f5f9',
                                padding: '2px 6px',
                                borderRadius: '4px',
                              }}
                            >
                              v{item.version}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>
                            {item.fecha}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#334155', lineHeight: '1.4' }}>
                            {item.descripcion}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {isItemCurrent ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                }}
                              >
                                ✓ Tu Versión
                              </span>
                            ) : isItemLatest ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  backgroundColor: '#dbeafe',
                                  color: '#1d4ed8',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                }}
                              >
                                Última
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '11px' }}>Archivada</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <button
              onClick={forceUpdateNow}
              disabled={isReloading}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                color: '#475569',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isReloading ? 'Vaciando...' : '🧹 Limpiar caché y recargar'}
            </button>
            <button
              onClick={() => setShowHistoryModal(false)}
              style={{
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 16px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.18)',
        fontSize: '12px',
      }}
    >
      {/* Alerta de bucle de recarga protegido */}
      {blockedByLoopProtection && (
        <div
          style={{
            backgroundColor: '#78350f',
            padding: '8px 12px',
            color: '#fef3c7',
            fontSize: '11.5px',
            lineHeight: '1.3',
          }}
        >
          <span>⚠️ Actualización v{latestVersion} disponible.</span>
          <button
            onClick={forceUpdateNow}
            disabled={isReloading}
            style={{
              marginTop: '4px',
              width: '100%',
              backgroundColor: '#f59e0b',
              color: '#000000',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 6px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {isReloading ? 'Recargando...' : 'Forzar recarga manual'}
          </button>
        </div>
      )}

      {/* Cabecera interactiva del widget en el menú */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'none',
          border: 'none',
          color: '#cbd5e1',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🏷️</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '12px' }}>
                v{currentVersion}
              </span>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: isUpToDate ? '#10b981' : '#f59e0b',
                }}
              />
            </div>
            <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>
              {isUpToDate ? 'Sistema al día' : `Nueva: v${latestVersion}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>{isExpanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Desplegable colapsable adentro del sidebar */}
      {isExpanded && (
        <div
          style={{
            padding: '10px 14px 14px 14px',
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Fila de versiones */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              padding: '6px 8px',
              borderRadius: '6px',
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: '11px' }}>Instalada:</span>
            <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>
              v{currentVersion}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              padding: '6px 8px',
              borderRadius: '6px',
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: '11px' }}>Servidor:</span>
            <span style={{ color: isUpToDate ? '#34d399' : '#fbbf24', fontWeight: 700, fontFamily: 'monospace' }}>
              v{latestVersion}
            </span>
          </div>

          {/* Botón de actualizar si hay versión nueva */}
          {!isUpToDate && (
            <button
              onClick={forceUpdateNow}
              disabled={isReloading}
              style={{
                width: '100%',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 10px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: isReloading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.3)',
              }}
            >
              <span>🔄</span>
              <span>{isReloading ? 'Actualizando...' : 'Actualizar ahora'}</span>
            </button>
          )}

          {/* Botones secundarios */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
            <button
              onClick={() => checkVersion()}
              disabled={isChecking || isReloading}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 8px',
                color: '#cbd5e1',
                fontSize: '11px',
                cursor: isChecking ? 'wait' : 'pointer',
              }}
              title="Comprobar si hay una nueva versión"
            >
              {isChecking ? 'Comprobando...' : '🔄 Comprobar'}
            </button>

            <button
              onClick={() => setShowHistoryModal(true)}
              style={{
                flex: 1.2,
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 8px',
                color: '#38bdf8',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Ver el historial completo de cambios"
            >
              📋 Historial
            </button>
          </div>

          {lastChecked && (
            <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
              Comprobado: {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Historial */}
      {showHistoryModal && renderHistoryModal()}
    </div>
  );
};
