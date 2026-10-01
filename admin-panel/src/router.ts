export type TabType = 
  | 'dashboard'
  | 'branches'
  | 'products'
  | 'superoffers'
  | 'excel'
  | 'clients'
  | 'ctaCte'
  | 'orders'
  | 'deliveries'
  | 'logistics'
  | 'zones'
  | 'payments'
  | 'paymentConfig'
  | 'clientConfig'
  | 'abandonedCarts'
  | 'users'
  | 'systemAdmin'
  | 'reports';

export interface RouteConfig {
  path: string;
  aliases?: string[];
  title: string;
}

export const ROUTE_CONFIGS: Record<TabType, RouteConfig> = {
  dashboard: {
    path: '/dashboard',
    aliases: ['/', '/dashboardview', '/inicio', '/panel'],
    title: 'Dashboard',
  },
  orders: {
    path: '/orders',
    aliases: ['/ordersview', '/pedidos', '/monitor-pedidos', '/monitorpedidos'],
    title: 'Monitor de Pedidos',
  },
  deliveries: {
    path: '/deliveries',
    aliases: ['/deliveriesview', '/hojas-de-ruta', '/hojasderuta', '/repartos'],
    title: 'Hojas de Ruta',
  },
  logistics: {
    path: '/logistics',
    aliases: ['/logisticsview', '/logistica'],
    title: 'Logística',
  },
  zones: {
    path: '/zones',
    aliases: ['/zonesview', '/zonas'],
    title: 'Zonas',
  },
  payments: {
    path: '/payments',
    aliases: ['/paymentsview', '/caja', '/caja-avanzada', '/cajaavanzada'],
    title: 'Caja Avanzada',
  },
  abandonedCarts: {
    path: '/abandonedcarts',
    aliases: [
      '/abandonedcartsview',
      '/abandoned-carts',
      '/carritos',
      '/carritos-abandonados',
      '/carritosabandonados',
      '/abandoned',
    ],
    title: 'Carritos Abandonados',
  },
  products: {
    path: '/products',
    aliases: ['/productsview', '/catalogo', '/catalogo-articulos', '/articulos', '/productos'],
    title: 'Catálogo de Artículos',
  },
  superoffers: {
    path: '/superoffers',
    aliases: ['/superoffersview', '/super-ofertas', '/superofertas', '/ofertas'],
    title: 'Súper Ofertas',
  },
  excel: {
    path: '/excel',
    aliases: ['/excelimport', '/excelimportview', '/excel-import', '/importar-excel'],
    title: 'Cargar desde Excel',
  },
  clients: {
    path: '/clients',
    aliases: ['/clientsview', '/clientes', '/directorio-clientes', '/directorio'],
    title: 'Directorio de Clientes',
  },
  ctaCte: {
    path: '/ctacte',
    aliases: ['/cta-cte', '/cuentas-corrientes', '/cuentascorrientes', '/cuentacorriente'],
    title: 'Cuentas Corrientes',
  },
  clientConfig: {
    path: '/clientconfig',
    aliases: ['/clientconfigview', '/client-config', '/categorias', '/categorias-app'],
    title: 'Categorías & App',
  },
  branches: {
    path: '/branches',
    aliases: ['/branchesview', '/sucursales', '/multi-sucursal'],
    title: 'Sucursales',
  },
  paymentConfig: {
    path: '/paymentconfig',
    aliases: ['/paymentconfigview', '/payment-config', '/medios-de-pago', '/mediosdepago', '/cbu'],
    title: 'Medios de Pago & CBU',
  },
  users: {
    path: '/users',
    aliases: ['/usersview', '/usuarios', '/permisos'],
    title: 'Usuarios & Permisos',
  },
  systemAdmin: {
    path: '/systemadmin',
    aliases: ['/systemadminview', '/system-admin', '/superadmin', '/sistema'],
    title: 'SuperAdmin',
  },
  reports: {
    path: '/reports',
    aliases: ['/reportsview', '/reportes', '/estadisticas'],
    title: 'Reportes & Estadísticas',
  },
};

/**
 * Normaliza un path quitando slashes extras y convirtiendo a minúsculas
 */
function cleanPath(input: string): string {
  let p = input.trim().toLowerCase();
  // Quitar hash o query params si vinieran incluidos
  p = p.split('?')[0].split('#')[0];
  // Quitar barra final salvo que sea solo "/"
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p;
}

/**
 * Resuelve el TabType correspondiente a partir de la URL actual (pathname, query param 'tab', o hash)
 */
export function parseLocationToTab(
  pathname: string = window.location.pathname,
  search: string = window.location.search,
  hash: string = window.location.hash
): TabType {
  // 1. Si hay parámetro ?tab=... en la URL
  try {
    const searchParams = new URLSearchParams(search);
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      const match = (Object.keys(ROUTE_CONFIGS) as TabType[]).find(
        (key) => key.toLowerCase() === tabParam.toLowerCase()
      );
      if (match) return match;
    }
  } catch {
    // ignorar
  }

  // 2. Si se utilizó hash routing (ej: #/abandonedcarts o #abandonedcarts)
  if (hash) {
    let cleanHash = hash.replace(/^#\/?/, '').toLowerCase();
    if (cleanHash) {
      cleanHash = `/${cleanHash}`;
      const foundByHash = matchPathToTab(cleanHash);
      if (foundByHash) return foundByHash;
    }
  }

  // 3. Evaluar el pathname
  const cleaned = cleanPath(pathname);
  if (!cleaned || cleaned === '/') {
    return 'dashboard';
  }

  const matchedTab = matchPathToTab(cleaned);
  return matchedTab || 'dashboard';
}

function matchPathToTab(cleanedPath: string): TabType | null {
  for (const [tabKey, config] of Object.entries(ROUTE_CONFIGS) as [TabType, RouteConfig][]) {
    if (config.path === cleanedPath) {
      return tabKey;
    }
    if (config.aliases && config.aliases.some((alias) => cleanPath(alias) === cleanedPath)) {
      return tabKey;
    }
  }
  return null;
}

/**
 * Obtiene la URL canónica para un TabType
 */
export function getTabPath(tab: TabType): string {
  const config = ROUTE_CONFIGS[tab];
  return config ? config.path : '/dashboard';
}

/**
 * Obtiene el título correspondiente a un TabType
 */
export function getTabTitle(tab: TabType): string {
  const config = ROUTE_CONFIGS[tab];
  return config ? `${config.title} · ADMIN QGD` : 'Panel de Administración · ADMIN QGD';
}

/**
 * Navega a una pestaña actualizando history y document.title
 */
export function navigateToTab(
  tab: TabType,
  options?: { replace?: boolean; preserveQuery?: boolean }
): void {
  if (typeof window === 'undefined') return;

  const targetPath = getTabPath(tab);
  const currentPath = window.location.pathname;

  let query = '';
  if (options?.preserveQuery && window.location.search) {
    // Si queremos preservar query params (ej: autologin=1), pero sin el ?tab= obsoleto
    const sp = new URLSearchParams(window.location.search);
    sp.delete('tab');
    const qs = sp.toString();
    if (qs) query = `?${qs}`;
  }

  const fullUrl = `${targetPath}${query}`;

  if (options?.replace || currentPath === targetPath) {
    window.history.replaceState({ tab }, '', fullUrl);
  } else {
    window.history.pushState({ tab }, '', fullUrl);
  }

  document.title = getTabTitle(tab);
}
