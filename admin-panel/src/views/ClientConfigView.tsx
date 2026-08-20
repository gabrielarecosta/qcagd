import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useAdminStore } from '../store/adminStore';
import { companySettingsService } from '@shared/services/companySettingsService';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

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
  const [isUploading, setIsUploading] = useState(false);
  const [imageTab, setImageTab] = useState<'url' | 'upload'>('upload');
  
  const [categoryBanners, setCategoryBanners] = useState<Record<string, string>>({});
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);

  // Helper to normalize category name to keys
  const getCategoryKey = (nombre: string): string => {
    const raw = nombre.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (raw.includes('quimic')) return 'quimicos';
    if (raw.includes('perfumer')) return 'perfumeria';
    return raw;
  };

  // Cargar banners y nombres de categorías guardados en Supabase
  useEffect(() => {
    const loadCategoryData = async () => {
      try {
        const { data: bannerData } = await supabase
          .from('category_banners')
          .select('*');
        if (bannerData) {
          const map: Record<string, string> = {};
          bannerData.forEach((b: any) => {
            map[b.categoria] = b.imagen;
          });
          setCategoryBanners(map);
        }

        const { data: nameData } = await supabase
          .from('category_names')
          .select('*');
        if (nameData) {
          const map: Record<string, string> = {};
          nameData.forEach((n: any) => {
            map[n.categoria] = n.nombre;
          });
          setCategoryNames(map);
        }
      } catch (e) {
        console.error('Error loading category data:', e);
      }
    };
    loadCategoryData();
  }, []);

  const saveCategoryName = async (categoria: string, nuevoNombre: string) => {
    try {
      const { error } = await supabase
        .from('category_names')
        .upsert({
          categoria,
          nombre: nuevoNombre,
          updated_at: new Date().toISOString()
        }, { onConflict: 'categoria' });
      if (error) {
        console.error('Error saving category name:', error);
      } else {
        setCategoryNames(prev => ({ ...prev, [categoria]: nuevoNombre }));
      }
    } catch (e) {
      console.error('Error saving category name:', e);
    }
  };

  const saveCategoryBanner = async (categoria: string, url: string) => {
    try {
      const { error } = await supabase
        .from('category_banners')
        .upsert({
          categoria,
          imagen: url,
          updated_at: new Date().toISOString()
        }, { onConflict: 'categoria' });
      if (error) {
        console.error('Error saving category banner:', error);
        alert('Error al guardar banner: ' + error.message);
      } else {
        setCategoryBanners(prev => ({ ...prev, [categoria]: url }));
      }
    } catch (e) {
      console.error('Error saving category banner:', e);
    }
  };

  const handleCategoryUpload = async (categoria: string, file: File) => {
    setUploadingCategory(categoria);
    try {
      const ext = file.name.split('.').pop();
      const path = `categories/${categoria}_${Date.now()}.${ext}`;
      let { error: upErr } = await supabase.storage
        .from('app-assets')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr && (upErr.message?.toLowerCase().includes('bucket not found') || (upErr as any).statusCode === '404')) {
        try {
          await supabase.storage.createBucket('app-assets', { public: true });
          const retryRes = await supabase.storage
            .from('app-assets')
            .upload(path, file, { upsert: true, contentType: file.type });
          upErr = retryRes.error;
        } catch (_) {}
      }

      if (upErr) {
        if (upErr.message?.toLowerCase().includes('bucket not found')) {
          throw new Error('El bucket "app-assets" no existe en Supabase Storage. Ejecute la migración SQL 10 en su panel de Supabase.');
        }
        throw upErr;
      }

      const { data: urlData } = supabase.storage
        .from('app-assets')
        .getPublicUrl(path);
      await saveCategoryBanner(categoria, urlData.publicUrl);
    } catch (err: any) {
      alert('Error al subir imagen: ' + (err.message || String(err)));
    } finally {
      setUploadingCategory(null);
    }
  };

  // App General Configs
  const [generalConfig, setGeneralConfig] = useState({
    nombreApp: 'Química General Deheza',
    telefonoSoporte: '5493511234567', // WhatsApp
    emailSoporte: 'soporte@quimicadeheza.com.ar',
    mensajeBienvenida: '¡Bienvenido a nuestra distribuidora! Realizá tu pedido fácil y rápido.',
    habilitarVentaMinorista: true,
    habilitarVentaMayorista: true,
    direccion: 'Bv. San Martín 123, General Deheza',
    telefono: '3584123456',
    instagram: 'quimica_deheza',
    facebook: 'quimicadeheza',
  });

  useEffect(() => {
    const loadCompanySettings = async () => {
      const settings = await companySettingsService.get();
      setGeneralConfig(prev => ({
        ...prev,
        telefonoSoporte: settings.whatsapp,
        direccion: settings.direccion,
        telefono: settings.telefono,
        instagram: settings.instagram,
        facebook: settings.facebook,
      }));
    };
    loadCompanySettings();
  }, []);

  const handleToggleCategory = (id: string) => {
    setCategoriesConfig(prev => 
      prev.map(cat => cat.id === id ? { ...cat, activa: !cat.activa } : cat)
    );
  };

  const saveBannersToSupabase = async (updatedBanners: AppBanner[]) => {
    try {
      const rows = updatedBanners.map((b, i) => ({
        id: b.id,
        titulo: b.titulo,
        subtitulo: b.subtitulo,
        imagen: b.imagen,
        link_destino: b.linkDestino,
        activo: b.activo,
        orden: i + 1,
      }));
      const { error } = await supabase
        .from('app_banners')
        .upsert(rows, { onConflict: 'id' });
      if (error) console.error('Error saving banners to Supabase:', error);
    } catch (e) {
      console.error('Error saving banners:', e);
    }
  };

  // Cargar banners guardados en Supabase al montar la vista
  useEffect(() => {
    const loadBanners = async () => {
      try {
        const { data, error } = await supabase
          .from('app_banners')
          .select('*')
          .order('orden', { ascending: true });
        if (!error && data && data.length > 0) {
          setBanners(data.map((b: any) => ({
            id: b.id,
            titulo: b.titulo,
            subtitulo: b.subtitulo || '',
            imagen: b.imagen || '',
            linkDestino: b.link_destino || '',
            activo: b.activo,
          })));
        }
      } catch (e) {
        console.error('Error loading banners:', e);
      }
    };
    loadBanners();
  }, []);
  const uploadBannerImage = async (file: File) => {
    if (!editingBanner) return;
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `banners/${editingBanner.id}_${Date.now()}.${ext}`;
      let { error: upErr } = await supabase.storage
        .from('app-assets')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr && (upErr.message?.toLowerCase().includes('bucket not found') || (upErr as any).statusCode === '404')) {
        try {
          await supabase.storage.createBucket('app-assets', { public: true });
          const retryRes = await supabase.storage
            .from('app-assets')
            .upload(path, file, { upsert: true, contentType: file.type });
          upErr = retryRes.error;
        } catch (_) {}
      }

      if (upErr) {
        if (upErr.message?.toLowerCase().includes('bucket not found')) {
          throw new Error('El bucket "app-assets" no existe en Supabase Storage. Ejecute la migración SQL 10 en su panel de Supabase.');
        }
        throw upErr;
      }

      const { data: urlData } = supabase.storage
        .from('app-assets')
        .getPublicUrl(path);
      setEditingBanner({ ...editingBanner, imagen: urlData.publicUrl });
    } catch (err: any) {
      alert('Error al subir imagen: ' + (err.message || String(err)));
    } finally {
      setIsUploading(false);
    }
  };
  const handleToggleBanner = (id: string) => {
    setBanners(prev => {
      const updated = prev.map(b => b.id === id ? { ...b, activo: !b.activo } : b);
      saveBannersToSupabase(updated);
      return updated;
    });
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await companySettingsService.update({
      whatsapp: generalConfig.telefonoSoporte,
      direccion: generalConfig.direccion,
      telefono: generalConfig.telefono,
      instagram: generalConfig.instagram,
      facebook: generalConfig.facebook,
    });
    if (success) {
      alert('✅ Configuración general guardada con éxito en la base de datos.');
    } else {
      alert('❌ Error al guardar la configuración en la base de datos.');
    }
  };

  const handleSaveBannerEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    setBanners(prev => {
      const updated = prev.map(b => b.id === editingBanner.id ? editingBanner : b);
      saveBannersToSupabase(updated);
      return updated;
    });
    setEditingBanner(null);
    alert('Banner guardado y publicado en la app.');
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>🖼️ Banners de Promoción de Inicio</h3>
              <button
                onClick={async () => {
                  await saveBannersToSupabase(banners);
                  alert('✅ Banners publicados en la app correctamente.');
                }}
                style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#2563EB', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
              >
                🚀 Publicar en App
              </button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '0', marginBottom: '16px' }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              {categoriesConfig.map(cat => {
                const catKey = getCategoryKey(cat.nombre);
                const currentImg = categoryBanners[catKey] || '';
                return (
                  <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: cat.activa ? 'var(--accent-light)' : '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid', borderColor: cat.activa ? 'var(--accent-color)' : '#e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '16px' }}>📦</span>
                          <input
                            type="text"
                            value={categoryNames[catKey] ?? cat.nombre}
                            onChange={e => {
                              const newVal = e.target.value;
                              setCategoryNames(prev => ({ ...prev, [catKey]: newVal }));
                            }}
                            onBlur={e => saveCategoryName(catKey, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                            }}
                            style={{
                              fontSize: '15px',
                              fontWeight: '700',
                              color: cat.activa ? 'var(--primary-color)' : 'var(--text-secondary)',
                              border: 'none',
                              borderBottom: '1px dashed #cbd5e1',
                              background: 'transparent',
                              padding: '2px 4px',
                              width: '180px',
                              outline: 'none',
                            }}
                            placeholder="Nombre Categoría"
                          />
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '22px' }}>{cat.itemsCount} productos asignados</div>
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

                    {/* Category Banner Editor */}
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ position: 'relative', width: '80px', height: '50px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {currentImg ? (
                          <img src={currentImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '20px' }}>🖼️</span>
                        )}
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {/* File input */}
                          <label style={{ display: 'inline-block', padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', color: '#475569' }}>
                            {uploadingCategory === catKey ? '⏳ Subiendo...' : '📁 Cargar Foto'}
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              disabled={uploadingCategory === catKey}
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleCategoryUpload(catKey, file);
                              }}
                            />
                          </label>

                          {/* URL input toggler */}
                          <button
                            type="button"
                            onClick={() => {
                              const url = prompt('Ingrese URL de la imagen:', currentImg);
                              if (url !== null) saveCategoryBanner(catKey, url);
                            }}
                            style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', color: '#475569' }}
                          >
                            🔗 Enlace Externo
                          </button>
                        </div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Banner recomendado: 800x250px (horizontal)</div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                  <label className="form-label">WhatsApp de Soporte (recibe consultas y comprobantes) — sin "+"</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: 5493511234567"
                    value={generalConfig.telefonoSoporte}
                    onChange={e => setGeneralConfig({ ...generalConfig, telefonoSoporte: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Dirección Física de la Química</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: Bv. San Martín 123, General Deheza"
                    value={generalConfig.direccion}
                    onChange={e => setGeneralConfig({ ...generalConfig, direccion: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono Fijo / Contacto Comercial</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: 3584123456"
                    value={generalConfig.telefono}
                    onChange={e => setGeneralConfig({ ...generalConfig, telefono: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Nombre de Usuario de Instagram (sin @)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: quimica_deheza"
                    value={generalConfig.instagram}
                    onChange={e => setGeneralConfig({ ...generalConfig, instagram: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nombre de Página de Facebook</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ej: quimicadeheza"
                    value={generalConfig.facebook}
                    onChange={e => setGeneralConfig({ ...generalConfig, facebook: e.target.value })}
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
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Imagen del Banner</label>

                  {/* Tabs */}
                  <div style={{ display: 'flex', gap: '0', marginBottom: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setImageTab('upload')}
                      style={{ flex: 1, padding: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '12px', background: imageTab === 'upload' ? '#2563EB' : '#f8fafc', color: imageTab === 'upload' ? '#fff' : '#475569', transition: 'all 0.15s' }}
                    >
                      📁 Subir Archivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageTab('url')}
                      style={{ flex: 1, padding: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '12px', background: imageTab === 'url' ? '#2563EB' : '#f8fafc', color: imageTab === 'url' ? '#fff' : '#475569', borderLeft: '1px solid #e2e8f0', transition: 'all 0.15s' }}
                    >
                      🔗 URL Externa
                    </button>
                  </div>

                  {/* Upload File */}
                  {imageTab === 'upload' && (
                    <label
                      htmlFor="banner-file-input"
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        border: '2px dashed #CBD5E1', borderRadius: '10px', padding: '20px',
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                        background: '#F8FAFC', transition: 'border-color 0.15s',
                        gap: '6px', minHeight: '90px'
                      }}
                      onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = '#2563EB'; }}
                      onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#CBD5E1'; }}
                      onDrop={e => {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).style.borderColor = '#CBD5E1';
                        const file = e.dataTransfer.files[0];
                        if (file && file.type.startsWith('image/')) uploadBannerImage(file);
                      }}
                    >
                      <input
                        id="banner-file-input"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={isUploading}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) uploadBannerImage(file);
                        }}
                      />
                      {isUploading ? (
                        <><span style={{ fontSize: '24px' }}>⏳</span><span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>Subiendo imagen...</span></>
                      ) : (
                        <><span style={{ fontSize: '28px' }}>🖼️</span><span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>Arrastrá una imagen aquí o hacé clic para elegir</span><span style={{ fontSize: '11px', color: '#94A3B8' }}>JPG, PNG, WEBP — recomendado 600×200px</span></>
                      )}
                    </label>
                  )}

                  {/* URL */}
                  {imageTab === 'url' && (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="https://example.com/imagen.jpg"
                      value={editingBanner.imagen}
                      onChange={e => setEditingBanner({ ...editingBanner, imagen: e.target.value })}
                    />
                  )}

                  {/* Live Preview */}
                  {editingBanner.imagen && (
                    <div style={{ marginTop: '10px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0', position: 'relative' }}>
                      <img
                        src={editingBanner.imagen}
                        alt="Preview"
                        style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', padding: '4px 8px' }}>
                        <div style={{ fontSize: '11px', color: '#fff', fontWeight: '700' }}>{editingBanner.titulo}</div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.8)' }}>{editingBanner.subtitulo}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingBanner({ ...editingBanner, imagen: '' })}
                        style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >✕</button>
                    </div>
                  )}
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
