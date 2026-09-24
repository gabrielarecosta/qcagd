import React, { useState } from 'react';
import { useAutoUpdate } from '../hooks/useAutoUpdate';

export const VersionFooter: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
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

  return (
    <footer
      style={{
        marginTop: 'auto',
        borderTop: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.03)',
        transition: 'all 0.3s ease',
        fontSize: '13px',
        color: '#475569',
        width: '100%',
        zIndex: 40,
      }}
    >
      {/* Alerta de bucle protegido si aplica */}
      {blockedByLoopProtection && (
        <div
          style={{
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fef3c7',
            padding: '8px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12.5px',
            color: '#b45309',
          }}
        >
          <span>
            ⚠️ <strong>Actualización pendiente:</strong> Se detectó la versión <strong>v{latestVersion}</strong>. Si los cambios no se reflejan, presiona "Forzar recarga" para vaciar la caché de disco.
          </span>
          <button
            onClick={forceUpdateNow}
            disabled={isReloading}
            style={{
              backgroundColor: '#d97706',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: '12px',
            }}
          >
            {isReloading ? 'Recargando...' : 'Forzar recarga ahora'}
          </button>
        </div>
      )}

      {/* Barra principal del Footer */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          gap: '12px',
        }}
      >
        {/* Lado izquierdo: Versión Activa vs Versión Servidor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>🏷️</span> Versión del Sistema:
          </span>

          {/* Versión actual activa */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 10px',
              borderRadius: '9999px',
              backgroundColor: isUpToDate ? '#ecfdf5' : '#eff6ff',
              border: `1px solid ${isUpToDate ? '#a7f3d0' : '#bfdbfe'}`,
              color: isUpToDate ? '#065f46' : '#1e40af',
              fontSize: '12px',
              fontWeight: 600,
            }}
            title="Versión instalada y en ejecución en este navegador"
          >
            <span style={{ fontSize: '9px' }}>●</span>
            Instalada: <strong>v{currentVersion}</strong>
          </span>

          {/* Versión más reciente en servidor */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 10px',
              borderRadius: '9999px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 600,
            }}
            title="Última versión disponible entregada por el backend"
          >
            Servidor: <strong>v{latestVersion}</strong>
          </span>

          {/* Estado de sincronización */}
          {isUpToDate ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: '#10b981',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              ✓ Actualizado
            </span>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                }}
              >
                ⚠️ Nueva versión disponible
              </span>
              <button
                onClick={forceUpdateNow}
                disabled={isReloading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: isReloading ? 'wait' : 'pointer',
                  boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                  transition: 'background-color 0.2s',
                }}
                title="Limpiar Service Workers, Caché Storage y recargar"
              >
                <span>🔄</span>
                {isReloading ? 'Actualizando...' : 'Actualizar ahora'}
              </button>
            </div>
          )}
        </div>

        {/* Lado derecho: Botón Historial de Versiones y Comprobar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => checkVersion()}
            disabled={isChecking || isReloading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              borderRadius: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: '12px',
              fontWeight: 500,
              cursor: isChecking ? 'wait' : 'pointer',
            }}
            title="Comprobar si hay una nueva versión en el servidor"
          >
            <span
              style={{
                display: 'inline-block',
                transform: isChecking ? 'rotate(360deg)' : 'none',
                transition: 'transform 0.5s linear',
              }}
            >
              🔄
            </span>
            {isChecking ? 'Comprobando...' : 'Comprobar'}
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 12px',
              borderRadius: '6px',
              backgroundColor: isExpanded ? '#0f172a' : '#f1f5f9',
              border: `1px solid ${isExpanded ? '#0f172a' : '#cbd5e1'}`,
              color: isExpanded ? '#ffffff' : '#1e293b',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            aria-expanded={isExpanded}
          >
            <span>📋</span>
            <span>Historial de versiones</span>
            <span style={{ fontSize: '10px' }}>{isExpanded ? '▲' : '▼'}</span>
          </button>
        </div>
      </div>

      {/* Sección Colapsable: Tabla con Historial de Versiones */}
      {isExpanded && (
        <div
          style={{
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#f8fafc',
            padding: '16px 24px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🚀</span> Registro de Versiones y Despliegues
            </h4>
            {lastChecked && (
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Última comprobación: {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>

          <div
            style={{
              overflowX: 'auto',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#ffffff',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '12.5px',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 700, width: '130px' }}>Versión</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, width: '110px' }}>Fecha</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700 }}>Cambios y Novedades</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, width: '120px', textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                      Cargando historial de versiones...
                    </td>
                  </tr>
                ) : (
                  history.map((item, index) => {
                    const isItemCurrent = item.version === currentVersion;
                    const isItemLatest = item.version === latestVersion;

                    return (
                      <tr
                        key={item.version || index}
                        style={{
                          borderBottom: index < history.length - 1 ? '1px solid #f1f5f9' : 'none',
                          backgroundColor: isItemCurrent ? 'rgba(16, 185, 129, 0.04)' : undefined,
                        }}
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e293b' }}>
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
                              Última Servidor
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

          {/* Acciones secundarias en el footer colapsable */}
          <div
            style={{
              marginTop: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '11.5px', color: '#64748b' }}>
              💡 Al detectar una versión nueva, el sistema limpia Service Workers y Cache Storage automáticamente.
            </span>
            <button
              onClick={forceUpdateNow}
              disabled={isReloading}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '11.5px',
                color: '#475569',
                cursor: 'pointer',
                fontWeight: 600,
              }}
              title="Limpia completamente el caché del navegador y recarga con parámetro de vaciado"
            >
              🧹 Limpiar caché y forzar recarga manual
            </button>
          </div>
        </div>
      )}
    </footer>
  );
};
