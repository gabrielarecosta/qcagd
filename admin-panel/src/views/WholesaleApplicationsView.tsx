import React, { useState, useEffect, useMemo } from 'react';
import { wholesaleService, WholesaleApplication } from '@shared/services/wholesaleService';
import { useAdminStore } from '../store/adminStore';

export function WholesaleApplicationsView() {
  const { currentUser } = useAdminStore();
  const [applications, setApplications] = useState<WholesaleApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'pendiente' | 'aprobada' | 'rechazada' | 'todas'>('pendiente');
  const [selectedRubro, setSelectedRubro] = useState<string>('todos');
  const [selectedAppModal, setSelectedAppModal] = useState<WholesaleApplication | null>(null);
  
  // Modal de rechazo
  const [rejectingApp, setRejectingApp] = useState<WholesaleApplication | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // Carga inicial de postulaciones
  const fetchApplications = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    else setLoading(true);

    try {
      const data = await wholesaleService.getAll();
      setApplications(data);
    } catch (err) {
      console.error('Error al cargar solicitudes mayoristas:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // KPIs
  const counts = useMemo(() => {
    const pendientes = applications.filter(a => a.estado === 'pendiente').length;
    const aprobadas = applications.filter(a => a.estado === 'aprobada').length;
    const rechazadas = applications.filter(a => a.estado === 'rechazada').length;
    const total = applications.length;
    return { pendientes, aprobadas, rechazadas, total };
  }, [applications]);

  // Lista única de rubros para filtro
  const rubrosList = useMemo(() => {
    const set = new Set<string>();
    applications.forEach(a => {
      if (a.rubro && a.rubro.trim()) set.add(a.rubro.trim());
    });
    return Array.from(set).sort();
  }, [applications]);

  // Filtrado reactivo
  const filteredApplications = useMemo(() => {
    let result = applications;

    // Filtro por pestaña de estado
    if (statusFilter !== 'todas') {
      result = result.filter(a => a.estado === statusFilter);
    }

    // Filtro por rubro
    if (selectedRubro !== 'todos') {
      result = result.filter(a => a.rubro === selectedRubro);
    }

    // Filtro por texto
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(a => {
        const razon = (a.razon_social || '').toLowerCase();
        const nom = (a.nombre || '').toLowerCase();
        const cuit = (a.cuit || '').toLowerCase();
        const email = (a.email || '').toLowerCase();
        const tel = (a.telefono || '').toLowerCase();
        const loc = (a.localidad || '').toLowerCase();
        const rubro = (a.rubro || '').toLowerCase();
        const notas = (a.notas || '').toLowerCase();

        return (
          razon.includes(q) ||
          nom.includes(q) ||
          cuit.includes(q) ||
          email.includes(q) ||
          tel.includes(q) ||
          loc.includes(q) ||
          rubro.includes(q) ||
          notas.includes(q)
        );
      });
    }

    return result;
  }, [applications, statusFilter, selectedRubro, search]);

  // Acción: Aprobar mayorista
  const handleApprove = async (app: WholesaleApplication) => {
    const confirmApprove = window.confirm(
      `¿Aprobar solicitud de "${app.razon_social || app.nombre}"?\n\nEl cliente pasará a tener perfil Mayorista Habilitado y podrá comprar con precios de lista mayorista.`
    );
    if (!confirmApprove) return;

    setIsProcessingAction(true);
    try {
      const res = await wholesaleService.approve(app, currentUser?.email || currentUser?.nombre || 'admin@quimicadeheza.com');
      if (res.success) {
        // Actualizar estado local
        setApplications(prev => prev.map(item => item.id === app.id ? { ...item, estado: 'aprobada', fecha_resolucion: new Date().toISOString() } : item));
        if (selectedAppModal?.id === app.id) {
          setSelectedAppModal(prev => prev ? { ...prev, estado: 'aprobada' } : null);
        }
        alert(`✅ ${res.message}`);
      }
    } catch (err: any) {
      alert('Error al aprobar solicitud mayorista: ' + (err?.message || err));
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Abrir modal de rechazo
  const handleOpenReject = (app: WholesaleApplication) => {
    setRejectingApp(app);
    setRejectReason('');
  };

  // Acción: Confirmar rechazo
  const handleConfirmReject = async () => {
    if (!rejectingApp) return;

    setIsProcessingAction(true);
    try {
      const res = await wholesaleService.reject(
        rejectingApp,
        rejectReason || 'No cumple requisitos mínimos de compra por volumen',
        currentUser?.email || currentUser?.nombre || 'admin@quimicadeheza.com'
      );
      if (res.success) {
        setApplications(prev => prev.map(item => item.id === rejectingApp.id ? { ...item, estado: 'rechazada', motivo_rechazo: rejectReason } : item));
        if (selectedAppModal?.id === rejectingApp.id) {
          setSelectedAppModal(prev => prev ? { ...prev, estado: 'rechazada', motivo_rechazo: rejectReason } : null);
        }
        setRejectingApp(null);
        alert('Solicitud rechazada correctamente.');
      }
    } catch (err: any) {
      alert('Error al rechazar solicitud: ' + (err?.message || err));
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Generador de enlace de WhatsApp
  const getWhatsAppLink = (app: WholesaleApplication, type: 'bienvenida' | 'consulta') => {
    const rawPhone = app.telefono;
    if (!rawPhone) return null;
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (!cleanPhone) return null;

    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
    if (!cleanPhone.startsWith('54')) cleanPhone = '549' + cleanPhone;

    const titular = app.nombre ? app.nombre.split(' ')[0] : 'Estimado/a';
    const negocio = app.razon_social || 'su comercio';

    let text = '';
    if (type === 'bienvenida') {
      text = `¡Hola ${titular}! 👋 Te escribimos desde *Química General Deheza*.\n\nQueríamos confirmarte que tu postulación como cliente mayorista para *${negocio}* ha sido *APROBADA* exitosamente. 🎉\n\nYa podés ingresar a nuestra tienda web con tu usuario y acceder a todos los precios mayoristas exclusivos por bulto/volumen.\n\nCualquier duda o pedido que quieras coordinar, estamos a tu disposición por este medio. ¡Muchas gracias por elegirnos!`;
    } else {
      text = `¡Hola ${titular}! 👋 Te escribimos desde *Química General Deheza* con relación a tu solicitud de cuenta mayorista para *${negocio}*.\n\nQueríamos consultarte algunos datos adicionales para terminar de procesar tu postulación. ¿Tendrás unos minutos para conversar? ¡Gracias!`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  // Copiar al portapapeles
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copiado al portapapeles: ${text}`);
  };

  return (
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              🏢 Solicitudes de Admisión Mayorista
            </h1>
            {counts.pendientes > 0 && (
              <span style={{
                backgroundColor: '#f59e0b',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '9999px',
                letterSpacing: '0.5px'
              }}>
                {counts.pendientes} PENDIENTE{counts.pendientes > 1 ? 'S' : ''}
              </span>
            )}
          </div>
          <p className="page-desc" style={{ marginTop: '4px' }}>
            Bandeja de entrada exclusiva para evaluar y admitir a los comercios, pañaleras y distribuidores postulados desde el formulario web.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => fetchApplications(true)}
            disabled={isRefreshing}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(360deg)' : 'none', transition: 'transform 0.4s linear' }}>
              🔄
            </span>
            {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card-wrapper" style={{ padding: '16px', borderLeft: '4px solid #f59e0b', cursor: 'pointer' }} onClick={() => setStatusFilter('pendiente')}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>⏳ Pendientes de Revisión</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>{counts.pendientes}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '2px' }}>Requieren aprobación o contacto</div>
        </div>

        <div className="card-wrapper" style={{ padding: '16px', borderLeft: '4px solid #10b981', cursor: 'pointer' }} onClick={() => setStatusFilter('aprobada')}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>✅ Mayoristas Aprobados</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>{counts.aprobadas}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '2px' }}>Comprando con lista mayorista</div>
        </div>

        <div className="card-wrapper" style={{ padding: '16px', borderLeft: '4px solid #ef4444', cursor: 'pointer' }} onClick={() => setStatusFilter('rechazada')}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>❌ Solicitudes Rechazadas</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#ef4444', marginTop: '4px' }}>{counts.rechazadas}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '2px' }}>Permanecen en lista minorista</div>
        </div>

        <div className="card-wrapper" style={{ padding: '16px', borderLeft: '4px solid #0284c7', cursor: 'pointer' }} onClick={() => setStatusFilter('todas')}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>📋 Total Postulaciones</div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>{counts.total}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '2px' }}>Historial acumulado del portal</div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="card-wrapper" style={{ padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          {/* Pestañas de estado */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className={`date-filter-btn ${statusFilter === 'pendiente' ? 'active' : ''}`}
              onClick={() => setStatusFilter('pendiente')}
              style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 700 }}
            >
              ⏳ Pendientes ({counts.pendientes})
            </button>
            <button
              className={`date-filter-btn ${statusFilter === 'aprobada' ? 'active' : ''}`}
              onClick={() => setStatusFilter('aprobada')}
              style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 700 }}
            >
              ✅ Aprobadas ({counts.aprobadas})
            </button>
            <button
              className={`date-filter-btn ${statusFilter === 'rechazada' ? 'active' : ''}`}
              onClick={() => setStatusFilter('rechazada')}
              style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 700 }}
            >
              ❌ Rechazadas ({counts.rechazadas})
            </button>
            <button
              className={`date-filter-btn ${statusFilter === 'todas' ? 'active' : ''}`}
              onClick={() => setStatusFilter('todas')}
              style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 700 }}
            >
              📋 Todas ({counts.total})
            </button>
          </div>

          {/* Buscador y filtro por rubro */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, minWidth: '280px', justifyContent: 'flex-end' }}>
            {rubrosList.length > 0 && (
              <select
                className="form-input"
                value={selectedRubro}
                onChange={e => setSelectedRubro(e.target.value)}
                style={{ width: '180px', fontSize: '13px', padding: '7px 10px' }}
              >
                <option value="todos">Todos los rubros</option>
                {rubrosList.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}

            <div style={{ position: 'relative', width: '260px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="🔍 Buscar por Razón Social, CUIT, Email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: '13px', padding: '7px 12px', width: '100%' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Postulaciones */}
      <div className="card-wrapper" style={{ overflow: 'hidden' }}>
        <div className="table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Razón Social & Titular</th>
                <th>CUIT / DNI</th>
                <th>Rubro & Volumen</th>
                <th>Contacto & Ubicación</th>
                <th>Estado</th>
                <th className="text-right">Acciones de Admisión</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid #cbd5e1', borderTop: '3px solid #0ea5e9', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <div style={{ marginTop: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>Cargando solicitudes...</div>
                  </td>
                </tr>
              ) : filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-disabled)' }}>
                    <div style={{ fontSize: '36px', marginBottom: '8px' }}>📭</div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-secondary)' }}>
                      No se encontraron solicitudes mayoristas {statusFilter !== 'todas' ? `en estado "${statusFilter}"` : ''}
                    </div>
                    {search && (
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        Probá borrando el texto de búsqueda "{search}".
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredApplications.map(app => {
                  const isPendiente = app.estado === 'pendiente';
                  const isAprobada = app.estado === 'aprobada';
                  const isRechazada = app.estado === 'rechazada';

                  const whatsappWelcome = getWhatsAppLink(app, 'bienvenida');
                  const whatsappChat = getWhatsAppLink(app, 'consulta');

                  const fechaFormateada = new Date(app.fecha_solicitud).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });

                  return (
                    <tr key={app.id}>
                      {/* Fecha */}
                      <td style={{ whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <div style={{ fontWeight: 600 }}>{fechaFormateada}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-disabled)' }}>
                          {new Date(app.fecha_solicitud).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Razón Social & Titular */}
                      <td>
                        <div style={{ fontWeight: 'bold', fontSize: '13.5px', color: 'var(--text-primary)' }}>
                          🏢 {app.razon_social || app.nombre}
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                          👤 {app.nombre}
                        </div>
                        {app.notas && (
                          <div style={{
                            fontSize: '11px',
                            color: '#1e3a8a',
                            backgroundColor: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            padding: '3px 6px',
                            marginTop: '4px',
                            maxWidth: '300px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }} title={app.notas}>
                            📝 {app.notas}
                          </div>
                        )}
                      </td>

                      {/* CUIT / DNI */}
                      <td style={{ fontSize: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>CUIT:</span>
                          <span>{app.cuit}</span>
                          {app.cuit && (
                            <button
                              onClick={() => copyToClipboard(app.cuit, 'CUIT')}
                              title="Copiar CUIT"
                              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0 2px', fontSize: '11px' }}
                            >
                              📋
                            </button>
                          )}
                        </div>
                        {app.dni && (
                          <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '2px' }}>
                            DNI: {app.dni}
                          </div>
                        )}
                      </td>

                      {/* Rubro & Volumen */}
                      <td>
                        <div style={{
                          display: 'inline-block',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                        }}>
                          🏷️ {app.rubro || 'General'}
                        </div>
                        {app.volumen_estimado && (
                          <div style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, marginTop: '3px' }}>
                            📦 {app.volumen_estimado}
                          </div>
                        )}
                      </td>

                      {/* Contacto & Ubicación */}
                      <td style={{ fontSize: '12px' }}>
                        {app.telefono && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>📞 {app.telefono}</span>
                            {whatsappChat && (
                              <a
                                href={whatsappChat}
                                target="_blank"
                                rel="noreferrer"
                                title="Abrir chat en WhatsApp"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  backgroundColor: '#25D366',
                                  color: '#ffffff',
                                  borderRadius: '50%',
                                  width: '18px',
                                  height: '18px',
                                  fontSize: '10px',
                                  textDecoration: 'none',
                                  fontWeight: 'bold',
                                }}
                              >
                                💬
                              </a>
                            )}
                          </div>
                        )}
                        {app.email && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            <a href={`mailto:${app.email}`} style={{ color: '#0284c7', textDecoration: 'none' }}>
                              ✉️ {app.email}
                            </a>
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--text-disabled)', marginTop: '2px' }}>
                          📍 {app.localidad ? `${app.localidad}, ` : ''}{app.provincia || 'Córdoba'}
                        </div>
                      </td>

                      {/* Estado */}
                      <td>
                        {isPendiente && (
                          <span className="badge badge-warning" style={{ fontWeight: 800 }}>
                            ⏳ Pendiente
                          </span>
                        )}
                        {isAprobada && (
                          <span className="badge badge-success" style={{ fontWeight: 800 }}>
                            ✓ Aprobada
                          </span>
                        )}
                        {isRechazada && (
                          <div>
                            <span className="badge badge-error" style={{ fontWeight: 800 }}>
                              🚫 Rechazada
                            </span>
                            {app.motivo_rechazo && (
                              <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '2px', maxWidth: '140px' }} title={app.motivo_rechazo}>
                                {app.motivo_rechazo}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Acciones de Admisión */}
                      <td className="text-right">
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '5px 10px', fontSize: '11px' }}
                            onClick={() => setSelectedAppModal(app)}
                            title="Ver detalles completos del postulante"
                          >
                            👁️ Ficha
                          </button>

                          {isPendiente && (
                            <>
                              <button
                                className="btn btn-primary"
                                style={{ padding: '5px 10px', fontSize: '11px', backgroundColor: '#16a34a', borderColor: '#15803d', color: '#ffffff' }}
                                onClick={() => handleApprove(app)}
                                disabled={isProcessingAction}
                                title="Aceptar y habilitar como cliente mayorista"
                              >
                                ✅ Aprobar
                              </button>

                              <button
                                className="btn btn-secondary"
                                style={{ padding: '5px 8px', fontSize: '11px', backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }}
                                onClick={() => handleOpenReject(app)}
                                disabled={isProcessingAction}
                                title="Rechazar postulación mayorista"
                              >
                                ❌ Rechazar
                              </button>
                            </>
                          )}

                          {isAprobada && whatsappWelcome && (
                            <a
                              href={whatsappWelcome}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary"
                              style={{ padding: '5px 10px', fontSize: '11px', backgroundColor: '#dcfce7', color: '#166534', borderColor: '#86efac', textDecoration: 'none' }}
                              title="Enviar mensaje de bienvenida y aviso por WhatsApp"
                            >
                              💬 Avisar WhatsApp
                            </a>
                          )}

                          {isRechazada && (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '5px 10px', fontSize: '11px' }}
                              onClick={() => handleApprove(app)}
                              disabled={isProcessingAction}
                              title="Re-evaluar y admitir como mayorista"
                            >
                              🔄 Admitir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ficha Completa del Postulante */}
      {selectedAppModal && (
        <div className="modal-backdrop" onClick={() => setSelectedAppModal(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '12px', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  🏢 {selectedAppModal.razon_social || selectedAppModal.nombre}
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Postulación Mayorista recibida el {new Date(selectedAppModal.fecha_solicitud).toLocaleString('es-AR')}
                </div>
              </div>
              <button onClick={() => setSelectedAppModal(null)} style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}>
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', fontSize: '13px' }}>
              <div>
                <span style={{ fontWeight: 600, color: '#64748b' }}>Titular / Solicitante:</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{selectedAppModal.nombre}</div>
              </div>

              <div>
                <span style={{ fontWeight: 600, color: '#64748b' }}>CUIT / CUIL:</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>{selectedAppModal.cuit}</div>
              </div>

              <div>
                <span style={{ fontWeight: 600, color: '#64748b' }}>Rubro Comercial:</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>🏷️ {selectedAppModal.rubro}</div>
              </div>

              <div>
                <span style={{ fontWeight: 600, color: '#64748b' }}>Volumen Estimado:</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>📦 {selectedAppModal.volumen_estimado || 'No especificado'}</div>
              </div>

              <div>
                <span style={{ fontWeight: 600, color: '#64748b' }}>Teléfono / WhatsApp:</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>📞 {selectedAppModal.telefono || 'Sin teléfono'}</div>
              </div>

              <div>
                <span style={{ fontWeight: 600, color: '#64748b' }}>Correo Electrónico:</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>✉️ {selectedAppModal.email || 'Sin email'}</div>
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontWeight: 600, color: '#64748b' }}>Dirección & Localidad:</span>
                <div style={{ fontWeight: 700, marginTop: '2px' }}>📍 {selectedAppModal.direccion}, {selectedAppModal.localidad} ({selectedAppModal.provincia || 'Córdoba'})</div>
              </div>

              {selectedAppModal.notas && (
                <div style={{ gridColumn: 'span 2', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 600, color: '#0369a1' }}>📝 Comentarios / Notas del Postulante:</span>
                  <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap', color: '#1e293b' }}>{selectedAppModal.notas}</div>
                </div>
              )}

              {selectedAppModal.motivo_rechazo && (
                <div style={{ gridColumn: 'span 2', backgroundColor: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  <span style={{ fontWeight: 600, color: '#b91c1c' }}>🚫 Motivo de Rechazo:</span>
                  <div style={{ marginTop: '4px', color: '#7f1d1d' }}>{selectedAppModal.motivo_rechazo}</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
              {selectedAppModal.estado === 'pendiente' && (
                <>
                  <button
                    className="btn btn-secondary"
                    style={{ backgroundColor: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' }}
                    onClick={() => {
                      const app = selectedAppModal;
                      setSelectedAppModal(null);
                      handleOpenReject(app);
                    }}
                  >
                    ❌ Rechazar Solicitud
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ backgroundColor: '#16a34a', borderColor: '#15803d' }}
                    onClick={() => handleApprove(selectedAppModal)}
                  >
                    ✅ Aprobar como Mayorista
                  </button>
                </>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedAppModal(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Rechazar Solicitud */}
      {rejectingApp && (
        <div className="modal-backdrop" onClick={() => setRejectingApp(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ backgroundColor: '#ffffff', borderRadius: '12px', maxWidth: '480px', width: '100%', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: 800, color: '#dc2626' }}>
              ❌ Rechazar Postulación Mayorista
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              ¿Estás seguro de rechazar la solicitud de <strong>"{rejectingApp.razon_social || rejectingApp.nombre}"</strong>? El cliente permanecerá como minorista habitual.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                Motivo del rechazo (opcional para constancia interna):
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Ej: No cumple volumen mínimo mensual / Fuera de zona de cobertura / Falta de documentación fiscal..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                style={{ width: '100%', fontSize: '13px', marginTop: '4px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setRejectingApp(null)} disabled={isProcessingAction}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                style={{ backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
                onClick={handleConfirmReject}
                disabled={isProcessingAction}
              >
                {isProcessingAction ? 'Rechazando...' : 'Confirmar Rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
