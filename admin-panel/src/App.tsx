import { useState, useMemo } from 'react';
import logoImg from './assets/logo.png';
import { useAdminStore } from './store/adminStore';

import { DashboardView } from './views/DashboardView';
import { BranchesView } from './views/BranchesView';
import { SectorsView } from './views/SectorsView';
import { ProductsView } from './views/ProductsView';
import { ExcelImportView } from './views/ExcelImportView';
import { ClientsView } from './views/ClientsView';
import { OrdersView } from './views/OrdersView';
import { DeliveriesView } from './views/DeliveriesView';
import { ZonesView } from './views/ZonesView';
import { PaymentsView } from './views/PaymentsView';
import { ClientConfigView } from './views/ClientConfigView';
import { UsersView } from './views/UsersView';
import { ReportsView } from './views/ReportsView';
import { LoginView } from './views/LoginView';

type TabType = 
  | 'dashboard'
  | 'branches'
  | 'sectors'
  | 'products'
  | 'excel'
  | 'clients'
  | 'orders'
  | 'deliveries'
  | 'zones'
  | 'payments'
  | 'clientConfig'
  | 'users'
  | 'reports';

const getSidebarIcon = (id: TabType) => {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    style: { marginRight: '10px' }
  };

  switch (id) {
    case 'dashboard':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="9" rx="1"/>
          <rect x="14" y="3" width="7" height="5" rx="1"/>
          <rect x="14" y="12" width="7" height="9" rx="1"/>
          <rect x="3" y="16" width="7" height="5" rx="1"/>
        </svg>
      );
    case 'orders':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      );
    case 'deliveries':
      return (
        <svg {...props}>
          <rect x="1" y="3" width="15" height="13" rx="2"/>
          <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      );
    case 'payments':
      return (
        <svg {...props}>
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
          <line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
      );
    case 'products':
      return (
        <svg {...props}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      );
    case 'excel':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      );
    case 'clients':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      );
    case 'branches':
      return (
        <svg {...props}>
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
          <line x1="9" y1="22" x2="9" y2="16"/>
          <line x1="15" y1="22" x2="15" y2="16"/>
          <path d="M9 16h6"/>
          <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01"/>
        </svg>
      );
    case 'sectors':
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      );
    case 'zones':
      return (
        <svg {...props}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      );
    case 'clientConfig':
      return (
        <svg {...props}>
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
          <line x1="12" y1="18" x2="12.01" y2="18"/>
        </svg>
      );
    case 'users':
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      );
    case 'reports':
      return (
        <svg {...props}>
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      );
    default:
      return null;
  }
};

import { useEffect } from 'react';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { 
    activeBranchId, 
    setActiveBranchId, 
    currentUser, 
    setCurrentUser,
    branches, 
    notifications, 
    markNotificationRead,
    markAllNotificationsRead,
    orders,
    clients,
    products,
    isLoading,
    fetchData
  } = useAdminStore();

  useEffect(() => {
    fetchData();
  }, []);

  const unreadNotifications = useMemo(() => {
    return notifications.filter(n => !n.leido);
  }, [notifications]);

  // Resultados de búsqueda global
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();

    const matchingOrders = orders.filter(o => {
      const client = clients.find(c => c.id === o.clienteId);
      const clientName = client ? client.nombre.toLowerCase() : '';
      return o.numero.toLowerCase().includes(query) || clientName.includes(query);
    }).slice(0, 3);

    const matchingClients = clients.filter(c => 
      c.nombre.toLowerCase().includes(query) || 
      (c.telefono && c.telefono.toLowerCase().includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query))
    ).slice(0, 3);

    const matchingProducts = products.filter(p => 
      p.nombre.toLowerCase().includes(query) || 
      p.codigo.toLowerCase().includes(query)
    ).slice(0, 3);

    return {
      orders: matchingOrders,
      clients: matchingClients,
      products: matchingProducts,
      hasResults: matchingOrders.length > 0 || matchingClients.length > 0 || matchingProducts.length > 0
    };
  }, [searchQuery, orders, clients, products]);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)',
        color: '#fff',
        fontFamily: 'sans-serif'
      }}>
        <div className="spinner" style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTop: '3px solid #0ea5e9',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '20px'
        }} />
        <p>Conectando con Supabase...</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', group: 'Operaciones' },
    { id: 'orders', label: 'Monitor Pedidos', group: 'Operaciones' },
    { id: 'deliveries', label: 'Hojas de Ruta', group: 'Operaciones' },
    { id: 'payments', label: 'Caja / Pagos', group: 'Operaciones' },
    
    { id: 'products', label: 'Catálogo Artículos', group: 'Catálogo & Clientes' },
    { id: 'excel', label: 'Cargar desde Excel', group: 'Catálogo & Clientes' },
    { id: 'clients', label: 'Directorio Clientes', group: 'Catálogo & Clientes' },
    
    { id: 'branches', label: 'Sucursales', group: 'Configuración' },
    { id: 'sectors', label: 'Sectores Internos', group: 'Configuración' },
    { id: 'zones', label: 'Zonas y Horarios', group: 'Configuración' },
    { id: 'clientConfig', label: 'Configuración App', group: 'Configuración' },
    { id: 'users', label: 'Personal / Roles', group: 'Configuración' },
    { id: 'reports', label: 'Reportes / Métricas', group: 'Configuración' },
  ] as const;

  // Render the selected view
  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView onNavigate={setActiveTab} />;
      case 'branches':
        return <BranchesView />;
      case 'sectors':
        return <SectorsView />;
      case 'products':
        return <ProductsView />;
      case 'excel':
        return <ExcelImportView />;
      case 'clients':
        return <ClientsView />;
      case 'orders':
        return <OrdersView />;
      case 'deliveries':
        return <DeliveriesView />;
      case 'zones':
        return <ZonesView />;
      case 'payments':
        return <PaymentsView />;
      case 'clientConfig':
        return <ClientConfigView />;
      case 'users':
        return <UsersView />;
      case 'reports':
        return <ReportsView />;
      default:
        return <DashboardView />;
    }
  };

  const handleSearchResultClick = (tab: TabType) => {
    setActiveTab(tab);
    setSearchQuery('');
  };

  if (!currentUser) {
    return <LoginView />;
  }

  return (
    <div className="app-container" style={{ display: 'flex', width: '100%' }}>
      {/* Sidebar Panel */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">
          {!sidebarCollapsed ? (
            <>
              <img src={logoImg} className="sidebar-logo-icon" alt="Logo" style={{ objectFit: 'contain', background: '#fff', padding: '2px' }} />
              <div className="sidebar-logo-text" style={{ flex: 1 }}>Química Deheza</div>
            </>
          ) : (
            <img src={logoImg} className="sidebar-logo-icon" alt="Logo" style={{ objectFit: 'contain', background: '#fff', padding: '2px', margin: '0' }} />
          )}
          <button 
            className="sidebar-toggle-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
            style={{ marginLeft: sidebarCollapsed ? '0' : '8px' }}
          >
            {sidebarCollapsed ? '❯' : '❮'}
          </button>
        </div>

        <nav className="sidebar-menu">
          {/* Group menu items by group name */}
          {['Operaciones', 'Catálogo & Clientes', 'Configuración'].map(groupName => (
            <div key={groupName} className="sidebar-menu-group" style={{ marginBottom: '12px' }}>
              <div className="sidebar-menu-group-title">
                <span>{groupName}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {menuItems.filter(item => item.group === groupName).map(item => (
                  <button
                    key={item.id}
                    className={`sidebar-item ${activeTab === item.id ? 'sidebar-item-active' : ''}`}
                    onClick={() => setActiveTab(item.id as TabType)}
                    style={{ border: 'none', background: 'none', textAlign: 'left', width: '100%', display: 'flex', alignItems: 'center' }}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      {getSidebarIcon(item.id)}
                      {sidebarCollapsed && item.id === 'dashboard' && unreadNotifications.length > 0 && (
                        <span style={{
                          position: 'absolute',
                          top: '-2px',
                          right: '-2px',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--accent-color)',
                          boxShadow: '0 0 0 2px var(--primary-color)'
                        }} />
                      )}
                    </div>
                    <span>{item.label}</span>
                    {!sidebarCollapsed && item.id === 'dashboard' && unreadNotifications.length > 0 && (
                      <span style={{
                        marginLeft: 'auto',
                        background: 'var(--accent-color)',
                        color: 'white',
                        fontSize: '10.5px',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontWeight: 'bold'
                      }}>
                        {unreadNotifications.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer User info */}
        {currentUser && (
          <div className="sidebar-footer" style={{ display: 'flex', alignItems: 'center', padding: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div className="sidebar-user-avatar">
              {currentUser.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <div className="sidebar-user-details" style={{ marginLeft: '10px', flex: 1 }}>
              <div className="sidebar-user" style={{ color: 'white', fontWeight: 600, fontSize: '13px' }}>{currentUser.nombre}</div>
              <div className="sidebar-role" style={{ color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase', marginTop: '2px' }}>
                {currentUser.rol === 'admin' ? 'Administrador' : currentUser.rol}
              </div>
            </div>
            {!sidebarCollapsed && (
              <button
                onClick={() => setCurrentUser(null)}
                title="Cerrar Sesión"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.background = 'none';
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Main Panel Content Wrapper */}
      <div className="main-wrapper">
        <header className="top-header">
          {/* Header Title Section & Branch filter */}
          <div className="header-title-section">
            <div className="sucursal-select-container">
              <span className="sucursal-select-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                  <line x1="9" y1="22" x2="9" y2="16"/>
                  <line x1="15" y1="22" x2="15" y2="16"/>
                  <path d="M9 16h6"/>
                </svg>
                Sucursal:
              </span>
              <select
                className="sucursal-select"
                value={activeBranchId}
                onChange={e => setActiveBranchId(e.target.value)}
                style={{ 
                  borderRadius: '9999px', 
                  padding: '6px 14px', 
                  fontSize: '13px', 
                  fontWeight: 600,
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0'
                }}
              >
                <option value="all">Todas</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Buscador Global Interactivo */}
          <div className="global-search-container">
            <div className="global-search-input-wrapper">
              <svg className="global-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                className="global-search-input"
                placeholder="Buscar pedido, cliente, SKU o artículo..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-disabled)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown de resultados de búsqueda */}
            {searchResults && searchQuery.trim() !== '' && (
              <div className="global-search-results-dropdown">
                {searchResults.hasResults ? (
                  <>
                    {/* Pedidos */}
                    {searchResults.orders.length > 0 && (
                      <div>
                        <div className="search-results-group-title">Pedidos</div>
                        {searchResults.orders.map(o => (
                          <div 
                            key={o.id} 
                            className="search-result-item"
                            onClick={() => handleSearchResultClick('orders')}
                          >
                            <span className="search-result-title">Pedido {o.numero}</span>
                            <span className="search-result-subtitle">
                              Total: ${(o.total).toLocaleString('es-AR')} • Estado: {o.estado.toUpperCase().replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Clientes */}
                    {searchResults.clients.length > 0 && (
                      <div>
                        <div className="search-results-group-title">Clientes</div>
                        {searchResults.clients.map(c => (
                          <div 
                            key={c.id} 
                            className="search-result-item"
                            onClick={() => handleSearchResultClick('clients')}
                          >
                            <span className="search-result-title">{c.nombre}</span>
                            <span className="search-result-subtitle">
                              Tel: {c.telefono || 'Sin teléfono'} • Email: {c.email || 'Sin email'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Productos */}
                    {searchResults.products.length > 0 && (
                      <div>
                        <div className="search-results-group-title">Catálogo Artículos</div>
                        {searchResults.products.map(p => (
                          <div 
                            key={p.id} 
                            className="search-result-item"
                            onClick={() => handleSearchResultClick('products')}
                          >
                            <span className="search-result-title">{p.nombre}</span>
                            <span className="search-result-subtitle">
                              SKU/Código: {p.codigo} • Precio: ${(p.precio).toLocaleString('es-AR')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-disabled)', fontSize: '13px' }}>
                    No se encontraron coincidencias
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User notifications and profile triggers */}
          <div className="header-actions" style={{ position: 'relative' }}>
            <button 
              className="btn btn-secondary" 
              style={{ 
                padding: '8px 16px', 
                position: 'relative',
                borderRadius: '9999px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#e2e8f0',
                backgroundColor: '#ffffff'
              }}
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              Alertas
              {unreadNotifications.length > 0 && (
                <span style={{ 
                  background: 'var(--error-color)', 
                  color: 'white', 
                  fontSize: '9.5px', 
                  padding: '1.5px 5px', 
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  lineHeight: 1
                }}>
                  {unreadNotifications.length}
                </span>
              )}
            </button>

            {/* Notification Popover Box */}
            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: '45px',
                right: 0,
                width: '320px',
                background: 'white',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-lg), 0 20px 25px -5px rgba(0, 0, 0, 0.05)',
                zIndex: 99,
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', background: '#f8fafc', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                  <span style={{ fontWeight: '700', fontSize: '13px' }}>Alertas y Notificaciones</span>
                  {unreadNotifications.length > 0 && (
                    <button 
                      style={{ border: 'none', background: 'none', color: 'var(--accent-color)', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                      onClick={markAllNotificationsRead}
                    >
                      Marcar todo leído
                    </button>
                  )}
                </div>
                <div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-disabled)', fontSize: '12px' }}>
                      No hay notificaciones activas.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        style={{ 
                          padding: '12px 16px', 
                          borderBottom: '1px solid #f1f5f9', 
                          background: n.leido ? '#ffffff' : 'rgba(14, 165, 233, 0.04)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s' 
                        }}
                        onClick={() => markNotificationRead(n.id)}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span style={{ fontWeight: 'bold', color: n.tipo === 'bajo_stock' ? 'var(--error-color)' : 'var(--accent-color)' }}>
                            {n.tipo === 'bajo_stock' ? '⚠️ STOCK BAJO' : '📥 NUEVO PEDIDO'}
                          </span>
                          <span>{new Date(n.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-primary)', lineHeight: '1.4' }}>{n.mensaje}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Inner views container */}
        <main className="view-content animate-fade-in" style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}

export default App;
