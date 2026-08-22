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
  deleted_at?: string | null;
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
  products?: { nombre: string; codigo: string; precio?: number };
}

interface SelectedComboItem {
  productId: string;
  nombre: string;
  codigo: string;
  precio: number;
  cantidad: number;
  unidad: string;
}

export function SuperOffersView() {
  const { superOffers, products, createSuperOffer, deleteSuperOffer, fetchSuperOffersOnly, fetchProductsOnly } = useAdminStore();

  React.useEffect(() => {
    fetchSuperOffersOnly();
    fetchProductsOnly();
  }, []);

  // Filter state
  const [filterTab, setFilterTab] = useState<'active' | 'paused' | 'deleted' | 'all'>('active');

  // Edit Modal State
  const [editingOffer, setEditingOffer] = useState<SuperOffer | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SuperOffer | null>(null);
  const [editForm, setEditForm] = useState({
    nombre: '',
    descripcion: '',
    precio_oferta: 0,
    fecha_fin: '',
    activo: true,
  });

  // Create Modal State
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    nombre: '',
    descripcion: '',
    precioOferta: 0,
    fechaFin: '',
  });
  const [selectedItems, setSelectedItems] = useState<SelectedComboItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Handlers for Edit
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

  // Soft Delete (Baja Lógica)
  const handleDelete = async (offer: SuperOffer) => {
    try {
      await deleteSuperOffer(offer.id);
      await fetchData(true);
      setConfirmDelete(null);
    } catch (err: any) {
      alert('Error al dar de baja la oferta: ' + (err.message || String(err)));
    }
  };

  // Handlers for Creation
  const handleOpenCreate = () => {
    setCreateForm({
      nombre: '',
      descripcion: '',
      precioOferta: 0,
      fechaFin: '',
    });
    setSelectedItems([]);
    setProductSearch('');
    setIsCreating(true);
  };

  const handleAddProductToCombo = (prod: any) => {
    if (selectedItems.some(i => i.productId === prod.id)) {
      alert('Este producto ya forma parte del combo');
      return;
    }
    let defaultQty = 1;
    const numMatch = (prod.presentacion || '').match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      defaultQty = parseFloat(numMatch[1]) || 1;
    }
    setSelectedItems(prev => [
      ...prev,
      {
        productId: prod.id,
        nombre: prod.nombre,
        codigo: prod.codigo || '',
        precio: prod.precio || 0,
        cantidad: defaultQty,
        unidad: prod.unidad || 'U'
      }
    ]);
    setProductSearch('');
  };

  const handleRemoveProductFromCombo = (productId: string) => {
    setSelectedItems(prev => prev.filter(i => i.productId !== productId));
  };

  const handleUpdateItemQty = (productId: string, qty: number) => {
    setSelectedItems(prev =>
      prev.map(i => (i.productId === productId ? { ...i, cantidad: Math.max(0.1, qty) } : i))
    );
  };

  const handleSaveNewOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      alert('Debés agregar al menos un producto al combo de la oferta.');
      return;
    }
    setIsSubmittingCreate(true);
    try {
      const originalPrice = selectedItems.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
      await createSuperOffer(
        {
          nombre: createForm.nombre.trim(),
          descripcion: createForm.descripcion.trim(),
          precioOriginal: originalPrice,
          precioOferta: createForm.precioOferta,
          fechaFin: createForm.fechaFin ? createForm.fechaFin : undefined,
          activo: true
        },
        selectedItems
      );
      await fetchData(true);
      setIsCreating(false);
      alert('🎉 ¡Súper Oferta Creada Exitosamente!');
    } catch (err: any) {
      alert('Error al crear la súper oferta: ' + (err.message || String(err)));
    } finally {
      setIsSubmittingCreate(false);
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

  // Filtered lists
  const allList = superOffers as SuperOffer[];
  const activeOffers = allList.filter(o => o.activo && !o.deleted_at);
  const pausedOffers = allList.filter(o => !o.activo && !o.deleted_at);
  const deletedOffers = allList.filter(o => Boolean(o.deleted_at));
  const totalSales = allList.reduce((sum, o) => sum + (o.veces_comprada || 0), 0);

  const filteredOffers =
    filterTab === 'active' ? activeOffers :
    filterTab === 'paused' ? pausedOffers :
    filterTab === 'deleted' ? deletedOffers :
    allList.filter(o => !o.deleted_at);

  const calculatedOriginalPrice = selectedItems.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
  const calculatedDiscount = calculatedOriginalPrice > 0 && createForm.precioOferta > 0
    ? Math.round(((calculatedOriginalPrice - createForm.precioOferta) / calculatedOriginalPrice) * 100)
    : 0;

  // Search results for adding products to combo
  const matchingProducts = productSearch.trim().length >= 2
    ? (products || []).filter(p =>
        p.nombre.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.codigo && p.codigo.toLowerCase().includes(productSearch.toLowerCase()))
      ).slice(0, 8)
    : [];

  return (
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">🔥 Gestión de Súper Ofertas</h1>
          <p className="page-desc">Administrá y creá combos promocionales visibles para clientes en la app</p>
        </div>
        <button
          onClick={handleOpenCreate}
          style={{
            padding: '12px 20px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            color: '#fff',
            border: 'none',
            fontWeight: '800',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ➕ Crear Súper Oferta
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        <div style={{ padding: '16px', textAlign: 'center', background: '#FEF3C7', border: '2px solid #F59E0B', borderRadius: '12px' }}>
          <div style={{ fontSize: '30px', fontWeight: '900', color: '#92400E' }}>{activeOffers.length + pausedOffers.length}</div>
          <div style={{ fontSize: '11px', color: '#78350F', fontWeight: '700', marginTop: '2px' }}>OFERTAS VIGENTES</div>
        </div>
        <div style={{ padding: '16px', textAlign: 'center', background: '#DCFCE7', border: '2px solid #16A34A', borderRadius: '12px' }}>
          <div style={{ fontSize: '30px', fontWeight: '900', color: '#14532D' }}>{activeOffers.length}</div>
          <div style={{ fontSize: '11px', color: '#166534', fontWeight: '700', marginTop: '2px' }}>ACTIVAS AHORA</div>
        </div>
        <div style={{ padding: '16px', textAlign: 'center', background: '#DBEAFE', border: '2px solid #2563EB', borderRadius: '12px' }}>
          <div style={{ fontSize: '30px', fontWeight: '900', color: '#1E3A8A' }}>{totalSales}</div>
          <div style={{ fontSize: '11px', color: '#1E40AF', fontWeight: '700', marginTop: '2px' }}>COMPRAS REALIZADAS</div>
        </div>
        <div style={{ padding: '16px', textAlign: 'center', background: '#F1F5F9', border: '2px solid #94A3B8', borderRadius: '12px' }}>
          <div style={{ fontSize: '30px', fontWeight: '900', color: '#475569' }}>{deletedOffers.length}</div>
          <div style={{ fontSize: '11px', color: '#475569', fontWeight: '700', marginTop: '2px' }}>HISTORIAL (BAJA LÓGICA)</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #E2E8F0', paddingBottom: '10px' }}>
        <button
          onClick={() => setFilterTab('active')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            background: filterTab === 'active' ? '#16A34A' : '#F1F5F9',
            color: filterTab === 'active' ? '#fff' : '#475569'
          }}
        >
          ● Activas ({activeOffers.length})
        </button>
        <button
          onClick={() => setFilterTab('paused')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            background: filterTab === 'paused' ? '#64748B' : '#F1F5F9',
            color: filterTab === 'paused' ? '#fff' : '#475569'
          }}
        >
          ⏸ Pausadas ({pausedOffers.length})
        </button>
        <button
          onClick={() => setFilterTab('all')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            background: filterTab === 'all' ? '#2563EB' : '#F1F5F9',
            color: filterTab === 'all' ? '#fff' : '#475569'
          }}
        >
          📋 Todas ({activeOffers.length + pausedOffers.length})
        </button>
        <button
          onClick={() => setFilterTab('deleted')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            background: filterTab === 'deleted' ? '#DC2626' : '#F1F5F9',
            color: filterTab === 'deleted' ? '#fff' : '#475569'
          }}
        >
          📁 Eliminadas / Reclamos ({deletedOffers.length})
        </button>
      </div>

      {/* Offers List */}
      {filteredOffers.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', background: '#F8FAFC', borderRadius: '12px', border: '2px dashed #CBD5E1' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎁</div>
          <h3 style={{ color: '#1E293B', marginBottom: '8px', fontSize: '18px', fontWeight: '700' }}>
            {filterTab === 'deleted' ? 'No hay ofertas en el historial de bajas lógicas' : 'No hay ofertas en esta vista'}
          </h3>
          <p style={{ color: '#475569', fontSize: '14px', marginBottom: '16px' }}>
            Hacé clic en el botón <strong>"➕ Crear Súper Oferta"</strong> para agregar un nuevo combo.
          </p>
          <button
            onClick={handleOpenCreate}
            style={{ padding: '10px 18px', borderRadius: '8px', background: '#F59E0B', color: '#fff', border: 'none', fontWeight: '700', cursor: 'pointer' }}
          >
            ➕ Crear Oferta Ahora
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredOffers.map(offer => {
            const discount = offer.precio_original > 0
              ? Math.round(((offer.precio_original - offer.precio_oferta) / offer.precio_original) * 100)
              : 0;
            const daysLeft = getDaysRemaining(offer.fecha_fin);
            const items: SuperOfferItem[] = offer.super_offer_items || [];
            const isExpired = offer.fecha_fin ? new Date(offer.fecha_fin) < new Date() : false;
            const isDeleted = Boolean(offer.deleted_at);

            // Card styling
            const cardBg = isDeleted ? '#FEF2F2'
              : isExpired ? '#FFF1F2'
              : offer.activo ? '#FFFBEB'
              : '#F8FAFC';
            const cardBorder = isDeleted ? '2px solid #FCA5A5'
              : isExpired ? '2px solid #FDA4AF'
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
                  boxShadow: offer.activo && !isExpired && !isDeleted ? '0 2px 12px rgba(245,158,11,0.15)' : '0 1px 4px rgba(0,0,0,0.06)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                  {/* Left: Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '17px', fontWeight: '800', color: '#0F172A' }}>{offer.nombre}</span>
                      
                      {/* Status badges */}
                      {isDeleted ? (
                        <span style={{ padding: '3px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', background: '#DC2626', color: '#fff' }}>📁 BAJA LÓGICA</span>
                      ) : isExpired ? (
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
                            {daysLeft !== null && !isExpired && !isDeleted && (
                              <span style={{ marginLeft: '6px', fontSize: '11px', background: daysLeft <= 3 ? '#FEF3C7' : '#F1F5F9', color: daysLeft <= 3 ? '#92400E' : '#475569', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                {daysLeft === 0 ? 'HOY' : `${daysLeft}d`}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {offer.deleted_at && (
                        <div>
                          <div style={{ fontSize: '10px', color: '#DC2626', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Dada de baja</div>
                          <div style={{ fontSize: '13px', color: '#DC2626', fontWeight: '700' }}>{formatDate(offer.deleted_at)}</div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: '10px', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Historial Compras</div>
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
                    {!isDeleted && (
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
                          onClick={() => setConfirmDelete(offer)}
                          style={{ padding: '8px 12px', borderRadius: '8px', border: '2px solid #EF4444', cursor: 'pointer', fontSize: '12px', fontWeight: '700', background: '#fff', color: '#DC2626' }}
                        >
                          🗑 Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE OFFER MODAL */}
      {isCreating && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', width: '95%', maxWidth: '680px', color: '#fff', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#F59E0B' }}>🔥 Crear Nueva Súper Oferta</h2>
              <button onClick={() => setIsCreating(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '22px' }}>✕</button>
            </div>

            <form onSubmit={handleSaveNewOffer} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#cbd5e1', display: 'block', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase' }}>Nombre de la Oferta *</label>
                <input
                  type="text"
                  style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', width: '100%', padding: '10px 14px', fontSize: '14px' }}
                  value={createForm.nombre}
                  onChange={e => setCreateForm({ ...createForm, nombre: e.target.value })}
                  placeholder="Ej: Combo Limpieza Total 4x3"
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#cbd5e1', display: 'block', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase' }}>Descripción para Clientes</label>
                <textarea
                  style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', width: '100%', padding: '10px 14px', height: '65px', resize: 'none', fontSize: '13px' }}
                  value={createForm.descripcion}
                  onChange={e => setCreateForm({ ...createForm, descripcion: e.target.value })}
                  placeholder="Detalles o instrucciones de la promoción..."
                />
              </div>

              {/* PRODUCTS SELECTOR FOR COMBO */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <label style={{ fontSize: '12px', color: '#60a5fa', display: 'block', marginBottom: '8px', fontWeight: '800', textTransform: 'uppercase' }}>
                  📦 Buscar y Agregar Productos al Combo ({selectedItems.length} seleccionados)
                </label>
                
                <input
                  type="text"
                  style={{ background: '#0f172a', border: '1px solid #3b82f6', color: '#fff', borderRadius: '8px', width: '100%', padding: '10px 14px', fontSize: '13px', marginBottom: '8px' }}
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  placeholder="Escribí el nombre o código del producto para buscar..."
                />

                {/* Search Autocomplete Results */}
                {matchingProducts.length > 0 && (
                  <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', overflow: 'hidden', marginBottom: '12px', maxHeight: '180px', overflowY: 'auto' }}>
                    {matchingProducts.map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProductToCombo(p)}
                        style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1e293b')}
                        onMouseLeave={e => (e.currentTarget.style.background = '#0f172a')}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#f8fafc' }}>{p.nombre}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{p.codigo} · Presentación: {p.presentacion || '1 U'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', fontWeight: '800', color: '#60a5fa' }}>{formatPrice(p.precio || 0)}</div>
                          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '700' }}>+ Agregar</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected Combo Items List */}
                {selectedItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    {selectedItems.map((item, idx) => (
                      <div key={item.productId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0f172a', padding: '10px 12px', borderRadius: '8px', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: '700' }}>{idx + 1}. {item.nombre}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Precio unitario: {formatPrice(item.precio)}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '11px', color: '#94a3b8' }}>Cant:</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            style={{ background: '#1e293b', border: '1px solid #475569', color: '#fff', width: '65px', padding: '4px 8px', borderRadius: '6px', fontWeight: '700', textAlign: 'center' }}
                            value={item.cantidad}
                            onChange={e => handleUpdateItemQty(item.productId, parseFloat(e.target.value) || 1)}
                          />
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>{item.unidad}</span>
                        </div>
                        <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: '800', color: '#38bdf8' }}>
                          {formatPrice(item.precio * item.cantidad)}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveProductFromCombo(item.productId)}
                          style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
                          title="Quitar"
                        >
                          🗑
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', marginTop: '8px' }}>
                    Buscá productos arriba para sumarlos a este combo.
                  </div>
                )}
              </div>

              {/* PRICES SUMMARY */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>
                    Precio Lista Original (Calculado)
                  </label>
                  <div style={{ fontSize: '20px', fontWeight: '900', color: '#cbd5e1' }}>
                    {formatPrice(calculatedOriginalPrice)}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: '#fbbf24', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '800' }}>
                    💰 Precio Especial de Oferta *
                  </label>
                  <input
                    type="number"
                    style={{ background: '#0f172a', border: '2px solid #fbbf24', color: '#fbbf24', borderRadius: '8px', width: '100%', padding: '10px 14px', fontSize: '18px', fontWeight: '900' }}
                    value={createForm.precioOferta || ''}
                    onChange={e => setCreateForm({ ...createForm, precioOferta: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    min="0"
                    required
                  />
                  {calculatedDiscount > 0 && (
                    <div style={{ fontSize: '11px', color: '#10b981', fontWeight: '800', marginTop: '4px' }}>
                      🔥 ¡Descuento de {calculatedDiscount}% OFF para el cliente!
                    </div>
                  )}
                </div>
              </div>

              {/* DATE */}
              <div>
                <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '700' }}>
                  📅 Fecha de Vencimiento (Opcional)
                </label>
                <input
                  type="date"
                  style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px', width: '100%', padding: '9px 12px' }}
                  value={createForm.fechaFin}
                  onChange={e => setCreateForm({ ...createForm, fechaFin: e.target.value })}
                />
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>Dejá vacío si la oferta es por tiempo indeterminado</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setIsCreating(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#334155', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={isSubmittingCreate} style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '800', boxShadow: '0 4px 10px rgba(245,158,11,0.3)' }}>
                  {isSubmittingCreate ? 'Creando Oferta...' : '🚀 Guardar Súper Oferta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
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

      {/* CONFIRM SOFT DELETE MODAL */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '16px', padding: '28px', width: '95%', maxWidth: '440px', color: '#fff', textAlign: 'center' }}>
            <div style={{ fontSize: '44px', marginBottom: '12px' }}>📁</div>
            <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: '800', color: '#f8fafc' }}>¿Dar de baja esta súper oferta?</h3>
            <p style={{ color: '#94a3b8', marginBottom: '16px', fontSize: '13px', lineHeight: '1.5' }}>
              Se aplicará una <strong>baja lógica</strong> a la oferta "{confirmDelete.nombre}".
            </p>
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', padding: '12px', borderRadius: '8px', marginBottom: '20px', textAlign: 'left', fontSize: '12px', color: '#fca5a5' }}>
              ✓ La oferta dejará de mostrarse a los clientes en la app.<br />
              ✓ El registro permanecerá archivado para auditorías, reclamos y trazabilidad de pedidos pasados.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#334155', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Sí, Dar de Baja (Lógica)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
