import { useState } from 'react';
import { useAdminStore } from '../store/adminStore';
import { formatPrice } from '@shared/utils/formatCurrency';

interface SuperOffer {
  id: string;
  nombre: string;
  descripcion?: string;
  precio_oferta: number;
  precio_original: number;
  activo: boolean;
  created_at?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  veces_comprada?: number;
  super_offer_items?: SuperOfferItem[];
}

interface SuperOfferItem {
  id: string;
  product_id: string;
  cantidad: number;
  unidad: string;
  products?: { nombre: string; codigo: string };
}

export function SuperOffersView() {
  const { superOffers, createSuperOffer, deleteSuperOffer, fetchData } = useAdminStore();
  const [editingOffer, setEditingOffer] = useState<SuperOffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: '',
    descripcion: '',
    precio_oferta: 0,
    fecha_fin: '',
    activo: true,
  });

  const handleOpenEdit = (offer: SuperOffer) => {
    setEditingOffer(offer);
    setEditForm({
      nombre: offer.nombre,
      descripcion: offer.descripcion || '',
      precio_oferta: offer.precio_oferta,
      fecha_fin: offer.fecha_fin ? offer.fecha_fin.split('T')[0] : '',
      activo: offer.activo,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOffer) return;
    setIsSaving(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      const { error } = await supabase
        .from('super_offers')
        .update({
          nombre: editForm.nombre,
          descripcion: editForm.descripcion || null,
          precio_oferta: editForm.precio_oferta,
          fecha_fin: editForm.fecha_fin ? new Date(editForm.fecha_fin).toISOString() : null,
          activo: editForm.activo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingOffer.id);
      if (error) throw error;
      await fetchData(true);
      setEditingOffer(null);
    } catch (err: any) {
      alert('Error al guardar: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (offer: SuperOffer) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );
      await supabase.from('super_offers').update({ activo: !offer.activo, updated_at: new Date().toISOString() }).eq('id', offer.id);
      await fetchData(true);
    } catch (err: any) {
      alert('Error al cambiar estado: ' + (err.message || String(err)));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSuperOffer(id);
      setConfirmDelete(null);
    } catch (err: any) {
      alert('Error al eliminar: ' + (err.message || String(err)));
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getDaysRemaining = (fechaFin?: string) => {
    if (!fechaFin) return null;
    const diff = Math.ceil((new Date(fechaFin).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const totalOffers = superOffers.length;
  const activeOffers = superOffers.filter((o: SuperOffer) => o.activo).length;
  const totalSales = superOffers.reduce((sum: number, o: SuperOffer) => sum + (o.veces_comprada || 0), 0);

  return (
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">🔥 Gestión de Súper Ofertas</h1>
          <p className="page-desc">Administrá las promociones y combos que ven los clientes en la app</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ padding: '20px', textAlign: 'center', background: '#FEF3C7', border: '2px solid #F59E0B', borderRadius: '12px' }}>
          <div style={{ fontSize: '36px', fontWeight: '900', color: '#92400E' }}>{totalOffers}</div>
          <div style={{ fontSize: '13px', color: '#78350F', fontWeight: '700', marginTop: '4px' }}>OFERTAS TOTALES</div>
        </div>
        <div style={{ padding: '20px', textAlign: 'center', background: '#DCFCE7', border: '2px solid #16A34A', borderRadius: '12px' }}>
          <div style={{ fontSize: '36px', fontWeight: '900', color: '#14532D' }}>{activeOffers}</div>
          <div style={{ fontSize: '13px', color: '#166534', fontWeight: '700', marginTop: '4px' }}>ACTIVAS AHORA</div>
        </div>
        <div style={{ padding: '20px', textAlign: 'center', background: '#DBEAFE', border: '2px solid #2563EB', borderRadius: '12px' }}>
          <div style={{ fontSize: '36px', fontWeight: '900', color: '#1E3A8A' }}>{totalSales}</div>
          <div style={{ fontSize: '13px', color: '#1E40AF', fontWeight: '700', marginTop: '4px' }}>COMPRAS DE PROMOS</div>
        </div>
      </div>

      {/* Offers List */}
      {superOffers.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', border: '2px dashed #CBD5E1' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎁</div>
          <h3 style={{ color: '#1E293B', marginBottom: '8px', fontSize: '18px', fontWeight: '700' }}>No hay ofertas creadas todavía</h3>
          <p style={{ color: '#475569', fontSize: '14px' }}>
            Andá a <strong>Catálogo Artículos</strong>, seleccioná productos y hacé clic en "🎁 Crear Oferta" para comenzar.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(superOffers as SuperOffer[]).map(offer => {
            const discount = offer.precio_original > 0
              ? Math.round(((offer.precio_original - offer.precio_oferta) / offer.precio_original) * 100)
              : 0;
            const daysLeft = getDaysRemaining(offer.fecha_fin);
            const items: SuperOfferItem[] = offer.super_offer_items || [];
            const isExpired = offer.fecha_fin ? new Date(offer.fecha_fin) < new Date() : false;

            // Card background based on state
            const cardBg = isExpired ? '#FEF2F2'
              : offer.activo ? '#FFFBEB'
              : '#F8FAFC';
            const cardBorder = isExpired ? '2px solid #FCA5A5'
              : offer.activo ? '2px solid #F59E0B'
              : '2px solid #CBD5E1';

            return (
              <div
                key={offer.id}
                style={{
                  padding: '20px 24px',
                  borderRadius: '14px',
                  background: cardBg,
                  border: cardBorder,
                  transition: 'all 0.2s',
                  boxShadow: offer.activo && !isExpired ? '0 2px 12px rgba(245,158,11,0.15)' : '0 1px 4px rgba(0,0,0,0.06)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  {/* Left: Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>{offer.nombre}</span>
                      {/* Status badge */}
                      {isExpired ? (
                        <span style={{ padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', background: '#EF4444', color: '#fff' }}>EXPIRADA</span>
                      ) : offer.activo ? (
                        <span style={{ padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', background: '#16A34A', color: '#fff' }}>● ACTIVA</span>
                      ) : (
                        <span style={{ padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', background: '#64748B', color: '#fff' }}>PAUSADA</span>
                      )}
                      {discount > 0 && (
                        <span style={{ padding: '3px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '900', background: '#DC2626', color: '#fff', letterSpacing: '0.5px' }}>-{discount}% OFF</span>
                      )}
                    </div>

                    {offer.descripcion && (
                      <p style={{ fontSize: '13px', color: '#334155', marginBottom: '10px', lineHeight: '1.5', fontWeight: '500' }}>{offer.descripcion}</p>
                    )}

                    {/* Items chips */}
                    {items.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                        {items.map(it => (
                          <span key={it.id} style={{ fontSize: '12px', padding: '4px 10px', background: '#1D4ED8', color: '#fff', borderRadius: '6px', fontWeight: '700' }}>
                            {it.cantidad} {it.unidad} · {it.products?.nombre || it.product_id}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Dates + Sales row */}
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Creada</div>
                        <div style={{ fontSize: '13px', color: '#1E293B', fontWeight: '600' }}>{formatDate(offer.created_at)}</div>
                      </div>
                      {offer.fecha_fin && (
                        <div>
                          <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Vence</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: isExpired ? '#DC2626' : daysLeft !== null && daysLeft <= 3 ? '#D97706' : '#1E293B' }}>
                            {formatDate(offer.fecha_fin)}
                            {daysLeft !== null && !isExpired && (
                              <span style={{ marginLeft: '6px', fontSize: '11px', background: daysLeft <= 3 ? '#FEF3C7' : '#F1F5F9', color: daysLeft <= 3 ? '#92400E' : '#475569', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                {daysLeft === 0 ? 'HOY' : `${daysLeft}d`}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Compras</div>
                        <div style={{ fontSize: '14px', color: '#1D4ED8', fontWeight: '800' }}>
                          🛒 {offer.veces_comprada || 0} pedidos
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Prices + Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', minWidth: '170px' }}>
                    <div style={{ textAlign: 'right', padding: '12px 16px', background: '#fff', borderRadius: '10px', border: '2px solid #E2E8F0', width: '100%' }}>
                      <div style={{ fontSize: '11px', color: '#94A3B8', textDecoration: 'line-through', fontWeight: '600' }}>
                        {formatPrice(offer.precio_original)}
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#DC2626', lineHeight: 1.1 }}>
                        {formatPrice(offer.precio_oferta)}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                      <button
                        onClick={() => handleToggleActive(offer)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '800',
                          background: offer.activo ? '#EF4444' : '#16A34A',
                          color: '#fff',
                          transition: 'all 0.15s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                        }}
                      >
                        {offer.activo ? '⏸ Pausar Oferta' : '▶ Activar Oferta'}
                      </button>
                      <button
                        onClick={() => handleOpenEdit(offer)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '2px solid #2563EB', cursor: 'pointer', fontSize: '12px', fontWeight: '700', background: '#fff', color: '#1D4ED8', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => setConfirmDelete(offer.id)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '2px solid #EF4444', cursor: 'pointer', fontSize: '12px', fontWeight: '700', background: '#fff', color: '#DC2626' }}
                      >
                        🗑 Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingOffer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '28px', width: '95%', maxWidth: '520px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>✏️ Editar Oferta</h2>
              <button onClick={() => setEditingOffer(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '20px' }}>✕</button>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '5px', textTransform: 'uppercase', fontWeight: '600' }}>Nombre</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', width: '100%', padding: '9px 12px' }}
                  value={editForm.nombre}
                  onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '5px', textTransform: 'uppercase', fontWeight: '600' }}>Descripción</label>
                <textarea
                  className="form-input"
                  style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', width: '100%', padding: '9px 12px', height: '70px', resize: 'none' }}
                  value={editForm.descripcion}
                  onChange={e => setEditForm({ ...editForm, descripcion: e.target.value })}
                  placeholder="Descripción visible para el cliente"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#fbbf24', display: 'block', marginBottom: '5px', textTransform: 'uppercase', fontWeight: '700' }}>💰 Precio Oferta</label>
                  <input
                    type="number"
                    className="form-input"
                    style={{ background: '#0f172a', border: '1px solid #fbbf24', color: '#fbbf24', borderRadius: '8px', width: '100%', padding: '9px 12px', fontWeight: '700' }}
                    value={editForm.precio_oferta}
                    onChange={e => setEditForm({ ...editForm, precio_oferta: parseFloat(e.target.value) || 0 })}
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '5px', textTransform: 'uppercase', fontWeight: '600' }}>📅 Fecha de Vencimiento</label>
                  <input
                    type="date"
                    className="form-input"
                    style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', width: '100%', padding: '9px 12px' }}
                    value={editForm.fecha_fin}
                    onChange={e => setEditForm({ ...editForm, fecha_fin: e.target.value })}
                  />
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>Dejá vacío para sin vencimiento</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#e2e8f0' }}>
                  <input
                    type="checkbox"
                    checked={editForm.activo}
                    onChange={e => setEditForm({ ...editForm, activo: e.target.checked })}
                  />
                  Oferta activa (visible para clientes en la app)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button type="button" onClick={() => setEditingOffer(null)} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#334155', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                <button type="submit" disabled={isSaving} style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#fbbf24', color: '#0f172a', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                  {isSaving ? 'Guardando...' : '💾 Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '16px', padding: '28px', width: '95%', maxWidth: '400px', color: '#fff', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 10px', fontSize: '18px' }}>¿Eliminar esta oferta?</h3>
            <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '13px' }}>
              Se eliminará permanentemente la oferta y sus ítems. Los pedidos existentes no se verán afectados.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#334155', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
