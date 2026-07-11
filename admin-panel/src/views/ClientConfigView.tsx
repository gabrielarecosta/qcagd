import React, { useState } from 'react';
import { useAdminStore } from '../store/adminStore';

interface AppBanner {
  id: string;
  titulo: string;
  subtitulo: string;
  imagen: string;
  linkDestino: string;
  activo: boolean;
}

export function ClientConfigView() {
  // Mock initial configuration states

  const [categoriesConfig, setCategoriesConfig] = useState([
    { id: '1', nombre: 'Limpieza', activa: true, itemsCount: 1540 },
    { id: '2', nombre: 'Químicos', activa: true, itemsCount: 1200 },
    { id: '3', nombre: 'Perfumería', activa: true, itemsCount: 850 },
    { id: '4', nombre: 'Descartables', activa: true, itemsCount: 600 },
    { id: '5', nombre: 'Piscina', activa: true, itemsCount: 400 },
    { id: '6', nombre: 'Industrial', activa: true, itemsCount: 950 },
    { id: '7', nombre: 'Hogar', activa: true, itemsCount: 300 },
    { id: '8', nombre: 'Institucional', activa: false, itemsCount: 160 },
  ]);

  const [banners, setBanners] = useState<AppBanner[]>([
    { 
      id: 'b-1', 
      titulo: 'Oferta Especial Otoño', 
      subtitulo: 'Bidón de Cloro Concentrado 10L con 20% OFF', 
      imagen: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
      linkDestino: 'prod-cloro-10l',
      activo: true 
    },
    { 
      id: 'b-2', 
      titulo: 'Productos de Piscina', 
      subtitulo: 'Prepará tu pileta para la temporada baja', 
      imagen: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&w=600&q=80',
      linkDestino: 'cat-piscina',
      activo: true 
    },
    { 
      id: 'b-3', 
      titulo: 'Mayorista Descartables', 
      subtitulo: 'Precios especiales en compras por bulto cerrado', 
      imagen: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?auto=format&fit=crop&w=600&q=80',
      linkDestino: 'cat-descartables',
      activo: false 
    }
  ]);

  const [activeBannerIdx, setActiveBannerIdx] = useState(0);
  const [editingBanner, setEditingBanner] = useState<AppBanner | null>(null);

  // App General Configs
  const [generalConfig, setGeneralConfig] = useState({
    nombreApp: 'Química Deheza',
    telefonoSoporte: '3584123456',
    emailSoporte: 'soporte@quimicadeheza.com.ar',
    mensajeBienvenida: '¡Bienvenido a nuestra distribuidora! Realizá tu pedido fácil y rápido.',
    habilitarVentaMinorista: true,
    habilitarVentaMayorista: true,
  });

  const handleToggleCategory = (id: string) => {
    setCategoriesConfig(prev => 
      prev.map(cat => cat.id === id ? { ...cat, activa: !cat.activa } : cat)
    );
  };

  const handleToggleBanner = (id: string) => {
    setBanners(prev => 
      prev.map(b => b.id === id ? { ...b, activo: !b.activo } : b)
    );
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Configuración general guardada con éxito.');
  };

  const handleSaveBannerEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    setBanners(prev => 
      prev.map(b => b.id === editingBanner.id ? editingBanner : b)
    );
    setEditingBanner(null);
  };

  const activeBannersForPreview = banners.filter(b => b.activo);

  return (
    <div className="view-container">
      <div style={{ marginBottom: '24px' }}>
        <h1 className="page-title">Configuración de App Cliente</h1>
        <p className="page-desc">Personalizar el aspecto visual, categorías activas y banners promocionales que ven los clientes</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* Lado izquierdo: Formularios */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Banner list Manager */}
          <div className="card-wrapper" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>🖼️ Banners de Promoción de Inicio</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '-8px', marginBottom: '16px' }}>
              Los banners se desplazan automáticamente en la pantalla de bienvenida del cliente móvil.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {banners.map(b => (
                <div key={b.id} style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <img src={b.imagen} alt="" style={{ width: '80px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '14px' }}>{b.titulo}</h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{b.subtitulo}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={b.activo} 
                        onChange={() => handleToggleBanner(b.id)}
                      />
                      Activo
                    </label>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => setEditingBanner(b)}
                    >
                      ✏️ Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Categorías Toggles */}
          <div className="card-wrapper" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>📂 Categorías Habilitadas en el Catálogo</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '-8px', marginBottom: '16px' }}>
              Oculte o habilite temporalmente secciones completas del catálogo móvil (Ej: desactivar Piscina durante el invierno).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {categoriesConfig.map(cat => (
                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: cat.activa ? 'var(--accent-light)' : '#f8fafc', borderRadius: '8px', border: '1px solid', borderColor: cat.activa ? 'var(--accent-color)' : '#e2e8f0' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: cat.activa ? 'var(--primary-color)' : 'var(--text-secondary)' }}>{cat.nombre}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{cat.itemsCount} productos asignados</div>
                  </div>
                  <button 
                    type="button" 
                    className={`btn ${cat.activa ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => handleToggleCategory(cat.id)}
                  >
                    {cat.activa ? '🟢 Habilitada' : '🔴 Oculta'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Configuración de Soporte */}
          <div className="card-wrapper" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>📞 Parámetros Generales y Canales de Soporte</h3>
            <form onSubmit={handleSaveGeneral}>
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Nombre Comercial de la Química</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={generalConfig.nombreApp}
                    onChange={e => setGeneralConfig({ ...generalConfig, nombreApp: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">WhatsApp de Soporte (con código de área)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={generalConfig.telefonoSoporte}
                    onChange={e => setGeneralConfig({ ...generalConfig, telefonoSoporte: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Email de Administración / Reclamaciones</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={generalConfig.emailSoporte}
                  onChange={e => setGeneralConfig({ ...generalConfig, emailSoporte: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Mensaje Rotativo de Bienvenida (App Móvil)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={generalConfig.mensajeBienvenida}
                  onChange={e => setGeneralConfig({ ...generalConfig, mensajeBienvenida: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}>
                  <input 
                    type="checkbox" 
                    checked={generalConfig.habilitarVentaMinorista}
                    onChange={e => setGeneralConfig({ ...generalConfig, habilitarVentaMinorista: e.target.checked })}
                  />
                  Habilitar Venta Minorista
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}>
                  <input 
                    type="checkbox" 
                    checked={generalConfig.habilitarVentaMayorista}
                    onChange={e => setGeneralConfig({ ...generalConfig, habilitarVentaMayorista: e.target.checked })}
                  />
                  Habilitar Venta Mayorista
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary">
                  💾 Guardar Cambios Generales
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Lado derecho: Mobile Preview Mockup */}
        <div style={{ position: 'sticky', top: '90px', alignSelf: 'start' }}>
          <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            📱 Vista Previa App Cliente
          </h3>
          
          {/* Phone Frame */}
          <div style={{ 
            width: '280px', 
            height: '520px', 
            background: '#ffffff', 
            border: '12px solid #0f172a', 
            borderRadius: '36px', 
            boxShadow: 'var(--shadow-lg)',
            margin: '0 auto',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative'
          }}>
            {/* Phone Notch */}
            <div style={{ width: '110px', height: '18px', background: '#0f172a', borderRadius: '0 0 12px 12px', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 99 }} />

            <div style={{ background: 'var(--primary-color)', color: '#fff', paddingTop: '24px', paddingBottom: '12px', paddingLeft: '12px', paddingRight: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 'bold' }}>
              {generalConfig.nombreApp}
            </div>


            {/* Mobile Content */}
            <div style={{ flex: 1, background: '#f8fafc', overflowY: 'auto', padding: '12px' }}>
              
              {/* Banner Slider Preview */}
              {activeBannersForPreview.length > 0 ? (
                <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', height: '110px', marginBottom: '12px', boxShadow: 'var(--shadow-sm)' }}>
                  <img 
                    src={activeBannersForPreview[activeBannerIdx]?.imagen} 
                    alt="" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', padding: '6px', color: '#fff' }}>
                    <div style={{ fontSize: '10px', fontWeight: 'bold' }}>{activeBannersForPreview[activeBannerIdx]?.titulo}</div>
                    <div style={{ fontSize: '8px', opacity: 0.8 }}>{activeBannersForPreview[activeBannerIdx]?.subtitulo}</div>
                  </div>

                  {activeBannersForPreview.length > 1 && (
                    <div style={{ position: 'absolute', top: '50%', right: '4px', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <button 
                        type="button" 
                        style={{ border: 'none', background: 'rgba(0,0,0,0.4)', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        onClick={() => setActiveBannerIdx(prev => (prev + 1) % activeBannersForPreview.length)}
                      >
                        ▶
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: '#e2e8f0', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#64748b', borderRadius: '8px', marginBottom: '12px' }}>
                  Sin banners activos
                </div>
              )}

              {/* Categorías Grid Mockup */}
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-secondary)' }}>Categorías</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {categoriesConfig.filter(c => c.activa).slice(0, 4).map(c => (
                  <div key={c.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', textAlign: 'center', fontSize: '10px', fontWeight: '600', boxShadow: 'var(--shadow-sm)' }}>
                    📦 {c.nombre}
                  </div>
                ))}
              </div>

              {/* Contact Button Mockup */}
              <div style={{ marginTop: '16px', background: '#25d366', color: '#fff', borderRadius: '6px', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '10px', fontWeight: 'bold' }}>
                💬 Pedido Rápido WhatsApp
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Modal Editar Banner */}
      {editingBanner && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <form onSubmit={handleSaveBannerEdit}>
              <div className="modal-header">
                <h2 className="card-title">Editar Banner Promocional</h2>
                <button type="button" className="btn-close" onClick={() => setEditingBanner(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Título de Banner</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editingBanner.titulo}
                    onChange={e => setEditingBanner({ ...editingBanner, titulo: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Subtítulo Descriptivo</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editingBanner.subtitulo}
                    onChange={e => setEditingBanner({ ...editingBanner, subtitulo: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">URL de Imagen (Unsplash u otro hosting)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editingBanner.imagen}
                    onChange={e => setEditingBanner({ ...editingBanner, imagen: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Acción de Destino (Link / Código de Producto)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editingBanner.linkDestino}
                    onChange={e => setEditingBanner({ ...editingBanner, linkDestino: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingBanner(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
