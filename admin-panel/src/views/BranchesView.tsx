import React, { useState, useEffect, useRef } from 'react';
import { useAdminStore } from '../store/adminStore';
import { Branch } from '@shared/types/branch';
import { formatPrice } from '@shared/utils/formatCurrency';
import { geocodeAddress } from '@shared/utils/geo';
import { suggestDehezaStreets } from '@shared/utils/dehezaStreets';
import { ExtraModuleWrapper } from '../components/ExtraModuleWrapper';

export function BranchesView() {
  const { branches, updateBranch, orders, users } = useAdminStore();
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  const branchMapRef = useRef<any>(null);
  const branchMarkerRef = useRef<any>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    await updateBranch(String(editingBranch.id), editingBranch);
    setEditingBranch(null);
  };

  // Autobúsqueda de coordenadas al presionar "Ubicar en Mapa"
  const handleGeocode = async () => {
    if (!editingBranch || !editingBranch.direccion.trim()) return;
    setIsGeocoding(true);

    try {
      const geo = await geocodeAddress(editingBranch.direccion, 'General Deheza', 'Córdoba');
      if (geo && (geo.latitude !== -32.7561 || geo.longitude !== -63.7845)) {
        setEditingBranch({
          ...editingBranch,
          direccion: geo.formattedAddress || editingBranch.direccion,
          latitude: geo.latitude,
          longitude: geo.longitude,
        });
      } else {
        const sug = suggestDehezaStreets(editingBranch.direccion, 1);
        if (sug.length > 0) {
          setEditingBranch({
            ...editingBranch,
            direccion: sug[0].fullAddress || editingBranch.direccion,
            latitude: sug[0].latitude,
            longitude: sug[0].longitude,
          });
        }
      }
    } catch (e) {
      console.warn('Error geocoding branch address:', e);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Inicializar o actualizar mapa interactivo de vista previa de sucursal
  useEffect(() => {
    if (!editingBranch) return;

    let isMounted = true;

    const initMap = async () => {
      if (!(window as any).L) {
        if (!document.getElementById('leaflet-css-cdn')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css-cdn';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        await new Promise((resolve) => {
          if ((window as any).L) return resolve(true);
          const script = document.createElement('script');
          script.id = 'leaflet-js-cdn';
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve(true);
          document.head.appendChild(script);
        });
      }

      if (!isMounted) return;
      const L = (window as any).L;
      if (!L) return;

      const container = document.getElementById('branch-edit-map');
      if (!container) return;

      const lat = editingBranch.latitude || -32.7650;
      const lng = editingBranch.longitude || -63.7860;

      if (!branchMapRef.current) {
        (container as any)._leaflet_id = null;
        const map = L.map(container, {
          center: [lat, lng],
          zoom: 15,
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap | Química General Deheza',
        }).addTo(map);

        map.on('click', (e: any) => {
          const newLat = Number(e.latlng.lat.toFixed(6));
          const newLng = Number(e.latlng.lng.toFixed(6));
          setEditingBranch(prev => prev ? { ...prev, latitude: newLat, longitude: newLng } : null);
        });

        branchMapRef.current = map;
      }

      const map = branchMapRef.current;
      map.setView([lat, lng], 15);

      if (branchMarkerRef.current) {
        branchMarkerRef.current.remove();
      }

      const iconHtml = `
        <div style="background: #0f172a; color: white; padding: 4px 8px; border-radius: 12px; font-weight: bold; font-size: 11px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white; white-space: nowrap;">
          🏬 ${editingBranch.nombre}
        </div>
      `;
      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'branch-leaflet-marker',
        iconSize: [160, 26],
        iconAnchor: [80, 13],
      });

      const marker = L.marker([lat, lng], { icon: customIcon, draggable: true }).addTo(map);

      marker.on('dragend', (e: any) => {
        const position = e.target.getLatLng();
        setEditingBranch(prev => prev ? {
          ...prev,
          latitude: Number(position.lat.toFixed(6)),
          longitude: Number(position.lng.toFixed(6))
        } : null);
      });

      branchMarkerRef.current = marker;
      setTimeout(() => { try { map.invalidateSize(); } catch (err) {} }, 100);
    };

    initMap();

    return () => {
      isMounted = false;
    };
  }, [editingBranch?.id, editingBranch?.latitude, editingBranch?.longitude]);

  // Limpiar referencia de mapa al cerrar modal
  const handleCloseModal = () => {
    if (branchMapRef.current) {
      try { branchMapRef.current.remove(); } catch (e) {}
      branchMapRef.current = null;
      branchMarkerRef.current = null;
    }
    setEditingBranch(null);
  };

  // Calcular estadísticas para cada sucursal en caliente
  const getBranchStats = (branchId: string | number) => {
    const branchOrders = orders.filter(o => String(o.branchId) === String(branchId));
    const branchDeliverersCount = users.filter(u => String(u.branchId) === String(branchId) && u.rol === 'repartidor').length;
    const totalSales = branchOrders
      .filter(o => o.estado === 'entregado')
      .reduce((sum, o) => sum + o.total, 0);

    return {
      ordersCount: branchOrders.length,
      deliverersCount: branchDeliverersCount,
      sales: totalSales,
    };
  };

  return (
    <div className="view-container">
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 className="page-title" style={{ margin: 0 }}>Gestión de Sucursales y Casa Central</h1>
          <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            📌 MÓDULO ADICIONAL OPCIONAL (COTIZA APARTE)
          </span>
        </div>
        <p className="page-desc" style={{ marginTop: '4px' }}>Administrar la ubicación de Casa Central / Depósito, datos de contacto y coordenadas geográficas</p>
      </div>

      <ExtraModuleWrapper title="Módulo Multi-Sucursal Avanzado" description="La gestión de múltiples sucursales con depósitos, reglas y stocks independientes se encuentra contemplada como módulo adicional opcional.">
        <div className="card-wrapper">
        <div className="card-header">
          <h2 className="card-title">Listado de Sucursales</h2>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Dirección</th>
                  <th>Coordenadas (Lat / Lng)</th>
                  <th>Contacto</th>
                  <th>Horario</th>
                  <th>Pedidos</th>
                  <th>Ventas</th>
                  <th>Estado</th>
                  <th className="text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(b => {
                  const stats = getBranchStats(b.id);
                  const isCentral = String(b.id) === '1' || b.id === 1 || b.nombre.toLowerCase().includes('central');
                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 'bold' }}>
                        {b.nombre} {isCentral ? <span style={{ backgroundColor: '#0f172a', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '8px', marginLeft: '4px' }}>CASA CENTRAL</span> : null}
                      </td>
                      <td>{b.direccion || 'Sin dirección asignada'}</td>
                      <td>
                        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: b.latitude ? '#0284c7' : '#94a3b8' }}>
                          {b.latitude && b.longitude ? `📍 ${b.latitude}, ${b.longitude}` : 'Sin coordenadas'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px' }}>📞 {b.telefono}</div>
                        <div style={{ fontSize: '13px', color: '#16a34a' }}>💬 WA: {b.whatsapp}</div>
                      </td>
                      <td style={{ fontSize: '13px' }}>{b.horarioAtencion}</td>
                      <td>{stats.ordersCount} pedidos</td>
                      <td style={{ fontWeight: '600' }}>{formatPrice(stats.sales)}</td>
                      <td>
                        <span className={`badge ${b.activo ? 'badge-success' : 'badge-error'}`}>
                          {b.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="text-right">
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => setEditingBranch(b)}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          ✏️ Editar Dirección
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </ExtraModuleWrapper>

      {/* Modal para Editar Sucursal / Casa Central */}
      {editingBranch && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <form onSubmit={handleSave}>
              <div className="modal-header">
                <h2 className="card-title">
                  Editar {String(editingBranch.id) === '1' || editingBranch.id === 1 || editingBranch.nombre.toLowerCase().includes('central') ? '🏬 Casa Central' : 'Sucursal'}
                </h2>
                <button 
                  type="button" 
                  onClick={handleCloseModal} 
                  style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Nombre de la Sucursal</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editingBranch.nombre}
                      onChange={e => setEditingBranch({ ...editingBranch, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Estado Operativo</label>
                    <select 
                      className="form-select"
                      value={editingBranch.activo ? 'true' : 'false'}
                      onChange={e => setEditingBranch({ ...editingBranch, activo: e.target.value === 'true' })}
                    >
                      <option value="true">Activa</option>
                      <option value="false">Inactiva</option>
                    </select>
                  </div>
                </div>

                {/* Dirección y botón de geocodificación */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold' }}>Dirección de Casa Central / Sucursal</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editingBranch.direccion}
                      onChange={e => setEditingBranch({ ...editingBranch, direccion: e.target.value })}
                      placeholder="Ej: Entre Ríos 151, General Deheza, Córdoba"
                      required
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={handleGeocode}
                      disabled={isGeocoding}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {isGeocoding ? '⌛ Buscando...' : '📍 Ubicar en Mapa'}
                    </button>
                  </div>
                </div>

                {/* Vista Previa del Mapa Interactivo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="form-label" style={{ fontSize: '12px', color: '#64748b', display: 'flex', justifyContent: 'space-between' }}>
                    <span>🗺️ Podés arrastrar el pin o hacer clic en el mapa para ajustar la ubicación exacta:</span>
                    <span style={{ fontWeight: 'bold', color: '#0284c7' }}>
                      {editingBranch.latitude && editingBranch.longitude ? `${editingBranch.latitude}, ${editingBranch.longitude}` : 'Sin definir'}
                    </span>
                  </label>
                  <div 
                    id="branch-edit-map" 
                    style={{ width: '100%', height: '200px', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden' }} 
                  />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Teléfono de Contacto</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editingBranch.telefono}
                      onChange={e => setEditingBranch({ ...editingBranch, telefono: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">WhatsApp (sin +)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={editingBranch.whatsapp}
                      onChange={e => setEditingBranch({ ...editingBranch, whatsapp: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Horario de Atención</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editingBranch.horarioAtencion}
                    onChange={e => setEditingBranch({ ...editingBranch, horarioAtencion: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  💾 Guardar Casa Central
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
