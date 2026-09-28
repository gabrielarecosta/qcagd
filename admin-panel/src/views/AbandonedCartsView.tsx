import React, { useState, useEffect, useMemo } from 'react';
import { cartService, AbandonedCart } from '@shared/services/cartService';
import { useAdminStore } from '../store/adminStore';
import { formatPrice } from '@shared/utils/formatCurrency';

export function AbandonedCartsView() {
  const { activeBranchId, branches } = useAdminStore();
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranchId ? String(activeBranchId) : 'all');
  const [selectedCartModal, setSelectedCartModal] = useState<AbandonedCart | null>(null);
  const [discardingUserId, setDiscardingUserId] = useState<string | null>(null);

  const fetchCarts = async () => {
    setLoading(true);
    try {
      const data = await cartService.getAbandonedCarts(selectedBranch === 'all' ? undefined : selectedBranch);
      setCarts(data);
    } catch (err) {
      console.error('Error al cargar carritos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarts();
  }, [selectedBranch]);

  // Manejar el descarte o limpieza de un carrito
  const handleDiscardCart = async (userId: string) => {
    if (!window.confirm('¿Estás seguro de descartar este carrito? Se vaciará de la base de datos.')) {
      return;
    }
    setDiscardingUserId(userId);
    try {
      const ok = await cartService.adminClearCart(userId);
      if (ok) {
        setCarts(prev => prev.filter(c => c.userId !== userId));
        if (selectedCartModal?.userId === userId) {
          setSelectedCartModal(null);
        }
      } else {
        alert('No se pudo descartar el carrito.');
      }
    } catch (err: any) {
      alert('Error al descartar carrito: ' + err.message);
    } finally {
      setDiscardingUserId(null);
    }
  };

  // Filtrado por buscador
  const filteredCarts = useMemo(() => {
    if (!search.trim()) return carts;
    const q = search.toLowerCase().trim();
    return carts.filter(c => {
      const name = c.customer?.nombre?.toLowerCase() || '';
      const razon = c.customer?.razonSocial?.toLowerCase() || '';
      const email = c.customer?.email?.toLowerCase() || '';
      const phone = c.customer?.telefono || c.customer?.whatsapp || '';
      const uid = c.userId.toLowerCase();
      const productMatches = c.items.some(it => 
        it.producto?.nombre?.toLowerCase().includes(q) || 
        it.producto?.codigo?.toLowerCase().includes(q)
      );

      return name.includes(q) || razon.includes(q) || email.includes(q) || phone.includes(q) || uid.includes(q) || productMatches;
    });
  }, [carts, search]);

  // KPIs
  const totalCarts = filteredCarts.length;
  const totalPotentialMoney = filteredCarts.reduce((acc, c) => acc + c.totalEstimated, 0);
  const totalUnits = filteredCarts.reduce((acc, c) => acc + c.totalQuantity, 0);
  const identifiedClients = filteredCarts.filter(c => Boolean(c.customer)).length;

  // Generador de link de WhatsApp
  const getWhatsAppLink = (cart: AbandonedCart) => {
    const rawPhone = cart.customer?.whatsapp || cart.customer?.telefono;
    if (!rawPhone) return null;
    const cleanPhone = rawPhone.replace(/\D/g, '');
    if (!cleanPhone) return null;

    // Asegurar prefijo de Argentina 549 si viene con 0 o 15
    let finalPhone = cleanPhone;
    if (finalPhone.startsWith('0')) finalPhone = finalPhone.substring(1);
    if (!finalPhone.startsWith('54')) finalPhone = '549' + finalPhone;

    const clientName = cart.customer?.nombre ? cart.customer.nombre.split(' ')[0] : 'Cliente';
    const itemsPreview = cart.items
      .slice(0, 3)
      .map(it => `• ${it.cantidad}x ${it.producto?.nombre || 'Producto'}`)
      .join('\n');
    const andMore = cart.items.length > 3 ? `\n... y ${cart.items.length - 3} producto(s) más` : '';

    const text = `¡Hola ${clientName}! 👋 Te escribimos desde *Química General Deheza*.\n\nNotamos que dejaste algunos productos guardados en tu carrito:\n${itemsPreview}${andMore}\n*Total estimado: ${formatPrice(cart.totalEstimated)}*\n\n¿Tuviste algún problema con la compra o necesitás que te ayudemos a coordinar el envío? Avisanos y te lo preparamos de inmediato. 😊`;

    return `https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`;
  };

  // Formateador de tiempo relativo
  const formatTimeAgo = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMin < 2) return 'Recién';
      if (diffMin < 60) return `Hace ${diffMin} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 30) return `Hace ${diffDays} días`;
      return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'inherit' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>🛒</span> Carritos Abandonados
          </h1>
          <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Supervisá los pedidos en proceso no concluidos por clientes y recuperá ventas con contacto directo por WhatsApp.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={fetchCarts}
            disabled={loading}
            style={{
              padding: '9px 16px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#334155',
              fontWeight: '600',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s',
            }}
          >
            <span>🔄</span> {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Carritos en Espera
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0284c7', marginTop: '6px' }}>
            {totalCarts}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            {identifiedClients} con cliente registrado
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Valor Total Potencial
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#16a34a', marginTop: '6px' }}>
            {formatPrice(totalPotentialMoney)}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            Monto acumulado en carritos activos
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Artículos en Espera
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#8b5cf6', marginTop: '6px' }}>
            {totalUnits} u.
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            Unidades acumuladas entre todos los carritos
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '18px 20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tasa de Identificación
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#ea580c', marginTop: '6px' }}>
            {totalCarts > 0 ? `${Math.round((identifiedClients / totalCarts) * 100)}%` : '0%'}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            Clientes contactables directamente
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px 20px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="Buscar por cliente, teléfono, email o producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {branches && branches.length > 1 && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: '#ffffff',
                color: '#334155',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Todas las sucursales</option>
              {branches.map(b => (
                <option key={b.id} value={String(b.id)}>{b.nombre}</option>
              ))}
            </select>
          )}
        </div>

        <div style={{ fontSize: '13px', color: '#64748b' }}>
          Mostrando <strong>{filteredCarts.length}</strong> de <strong>{carts.length}</strong> carritos
        </div>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
            <div>Cargando carritos abandonados...</div>
          </div>
        ) : filteredCarts.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎉</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>No hay carritos abandonados</div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
              {search ? 'Ningún carrito coincide con los términos de búsqueda.' : 'Todos los clientes han completado sus compras o vaciado sus carritos.'}
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '14px 16px' }}>Cliente</th>
                  <th style={{ padding: '14px 16px' }}>Contacto</th>
                  <th style={{ padding: '14px 16px' }}>Última Actividad</th>
                  <th style={{ padding: '14px 16px' }}>Productos</th>
                  <th style={{ padding: '14px 16px' }}>Total Estimado</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredCarts.map((cart) => {
                  const waLink = getWhatsAppLink(cart);
                  const isDiscarding = discardingUserId === cart.userId;

                  return (
                    <tr
                      key={cart.userId}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Cliente */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        {cart.customer ? (
                          <div>
                            <div style={{ fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>👤</span> {cart.customer.nombre}
                              {cart.customer.tipoCliente === 'mayorista' && (
                                <span style={{ fontSize: '11px', backgroundColor: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                  Mayorista
                                </span>
                              )}
                            </div>
                            {cart.customer.razonSocial && (
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                {cart.customer.razonSocial}
                              </div>
                            )}
                            {cart.customer.localidad && (
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                📍 {cart.customer.localidad}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span style={{ fontSize: '11px', backgroundColor: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '6px', fontWeight: '600' }}>
                              Usuario ID: {cart.userId.substring(0, 12)}...
                            </span>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                              (Sin datos personales cargados)
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Contacto */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        {cart.customer ? (
                          <div>
                            {(cart.customer.whatsapp || cart.customer.telefono) ? (
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                                📞 {cart.customer.whatsapp || cart.customer.telefono}
                              </div>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Sin teléfono</span>
                            )}
                            {cart.customer.email && (
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                ✉️ {cart.customer.email}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>-</span>
                        )}
                      </td>

                      {/* Última Actividad */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                          {formatTimeAgo(cart.updatedAt)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                          {new Date(cart.updatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs
                        </div>
                      </td>

                      {/* Productos preview */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#0284c7', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '10px' }}>
                            {cart.totalQuantity} u. ({cart.items.length} {cart.items.length === 1 ? 'producto' : 'productos'})
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cart.items.map(i => `${i.cantidad}x ${i.producto?.nombre || 'Producto'}`).join(', ')}
                        </div>
                      </td>

                      {/* Total Estimado */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontSize: '16px', fontWeight: '800', color: '#16a34a' }}>
                          {formatPrice(cart.totalEstimated)}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                          {waLink && (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Contactar al cliente por WhatsApp para recuperar la venta"
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#25D366',
                                color: '#ffffff',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                fontSize: '12px',
                                fontWeight: '700',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                              }}
                            >
                              <span>📱</span> Contactar
                            </a>
                          )}

                          <button
                            onClick={() => setSelectedCartModal(cart)}
                            title="Ver detalle completo de los artículos"
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              color: '#334155',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            👁️ Ver
                          </button>

                          <button
                            onClick={() => handleDiscardCart(cart.userId)}
                            disabled={isDiscarding}
                            title="Descartar este carrito de la base de datos"
                            style={{
                              padding: '6px 10px',
                              backgroundColor: '#fee2e2',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              color: '#b91c1c',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: isDiscarding ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {isDiscarding ? '...' : '🗑️'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detalle de Carrito */}
      {selectedCartModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Detalle del Carrito Abandonado
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {selectedCartModal.customer ? `${selectedCartModal.customer.nombre} · ` : ''} 
                  Última actualización: {new Date(selectedCartModal.updatedAt).toLocaleString('es-AR')}
                </div>
              </div>
              <button
                onClick={() => setSelectedCartModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px 8px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Info Cliente */}
              {selectedCartModal.customer && (
                <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                      👤 {selectedCartModal.customer.nombre}
                    </div>
                    {selectedCartModal.customer.email && (
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        ✉️ {selectedCartModal.customer.email}
                      </div>
                    )}
                    {(selectedCartModal.customer.whatsapp || selectedCartModal.customer.telefono) && (
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        📞 {selectedCartModal.customer.whatsapp || selectedCartModal.customer.telefono}
                      </div>
                    )}
                  </div>
                  {getWhatsAppLink(selectedCartModal) && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <a
                        href={getWhatsAppLink(selectedCartModal)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '8px 14px',
                          backgroundColor: '#25D366',
                          color: '#ffffff',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          fontSize: '12px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>📱</span> Chatear por WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Items List */}
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>
                Artículos en el carrito ({selectedCartModal.items.length})
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left' }}>Producto</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Cantidad</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Precio Unit.</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCartModal.items.map((item, idx) => {
                      const p = item.producto || {};
                      const price = Number(p.precioFinal ?? p.precioVenta ?? p.precio_venta ?? p.precio ?? 0);
                      const subtotal = price * Number(item.cantidad || 0);

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: '600', color: '#0f172a' }}>
                              {p.nombre || 'Producto sin nombre'}
                            </div>
                            {p.codigo && (
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                Cód: {p.codigo}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#0284c7' }}>
                            {item.cantidad}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>
                            {formatPrice(price)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                            {formatPrice(subtotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#166534' }}>
                  Total Estimado ({selectedCartModal.totalQuantity} unidades):
                </span>
                <span style={{ fontSize: '20px', fontWeight: '800', color: '#15803d' }}>
                  {formatPrice(selectedCartModal.totalEstimated)}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
              <button
                onClick={() => handleDiscardCart(selectedCartModal.userId)}
                style={{
                  padding: '9px 16px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#b91c1c',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                🗑️ Descartar Carrito
              </button>

              <button
                onClick={() => setSelectedCartModal(null)}
                style={{
                  padding: '9px 20px',
                  backgroundColor: '#0f172a',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
