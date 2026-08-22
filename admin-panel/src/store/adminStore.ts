import { create } from 'zustand';
import {
  Branch,
  InternalUser,
  Customer,
  Product,
  ProductStock,
  Order,
  DeliveryRoute,
  DeliveryStatus,
  DeliveryStop,
  OrderStatus,
  BranchSchedule,
  InternalNotification,
  PaymentLog,
} from '@shared/types';
import {
  branchService,
  userService,
  clientService,
  productService,
  orderService,
  deliveryService,
  paymentService,
  notificationService,
  routeService,
  supabase
} from '@shared/services';

interface AdminStore {
  // Estado activo
  activeBranchId: string | number | 'all';
  currentUser: InternalUser | null;
  isLoading: boolean;
  
  // Tablas
  branches: Branch[];
  users: InternalUser[];
  clients: Customer[];
  products: Product[];
  stocks: ProductStock[];
  orders: Order[];
  deliveries: DeliveryRoute[];
  schedules: BranchSchedule[];
  notifications: InternalNotification[];
  payments: PaymentLog[];
  superOffers: any[];
  drivers: any[];
  globalMinOrderAmount: number;

  // Acciones globales
  setActiveBranchId: (id: string | number | 'all') => void;
  setCurrentUser: (user: InternalUser | null) => void;
  fetchData: (silent?: boolean) => Promise<void>;
  fetchProductsOnly: () => Promise<void>;
  fetchClientsOnly: () => Promise<void>;
  fetchOrdersOnly: () => Promise<void>;
  fetchDeliveriesOnly: () => Promise<void>;
  fetchPaymentsOnly: () => Promise<void>;
  fetchUsersOnly: () => Promise<void>;
  fetchSuperOffersOnly: () => Promise<void>;
  updateGlobalMinOrderAmount: (amount: number) => Promise<void>;
  
  // Sucursales
  updateBranch: (id: string | number, updates: Partial<Branch>) => Promise<void>;
  createBranch: (branch: Omit<Branch, 'id'>) => Promise<void>;
  
  // Usuarios
  updateUser: (id: string | number, updates: Partial<InternalUser>) => Promise<void>;
  createUser: (user: Omit<InternalUser, 'id'>) => Promise<void>;
  deleteUser: (id: string | number) => Promise<void>;
  
  // Productos & Stock
  updateProduct: (id: string | number, updates: Partial<Product> & { dolarizado?: boolean; precio_usd?: number }) => Promise<void>;
  createProduct: (product: Omit<Product, 'id'> & { dolarizado?: boolean; precio_usd?: number }, initialStock: Record<string, number>) => Promise<void>;
  updateBranchStock: (productId: string | number, branchId: string | number, stock: number, stockMinimo: number, reason?: string) => Promise<void>;
  bulkReplaceCatalog: (newProducts: Product[], branchId: string | number, rowStocks: any, fileName: string) => Promise<void>;
  bulkUpdateExistingCatalog: (updatedProducts: Product[], branchId: string | number, rowStocks: any, fileName: string) => Promise<void>;
  bulkAddNewCatalog: (newProducts: Product[], branchId: string | number, rowStocks: any, fileName: string) => Promise<void>;
  checkFileHashExists: (hash: string) => Promise<any | null>;
  checkDuplicateImport: (fileName: string, hash: string) => Promise<any | null>;
  fetchImportsHistory: (limit?: number) => Promise<any[]>;
  createStagingImport: (fileName: string, fileHash: string, stagedRowsCount: number) => Promise<any>;
  insertStagingRows: (importId: string | number, rows: any[]) => Promise<void>;
  updateStagingRow: (rowId: string | number, updates: { estado: string; datos: any }) => Promise<void>;
  confirmImport: (importId: string | number, branchId: string | number) => Promise<any>;
  
  // Clientes
  updateClient: (id: string | number, updates: Partial<Customer>) => Promise<void>;
  createClient: (client: Omit<Customer, 'id' | 'fechaAlta'>) => Promise<void>;

  // Pedidos
  updateOrderStatus: (id: string | number, status: OrderStatus, notes?: string, clientNotes?: string) => Promise<void>;
  updateOrder: (id: string | number, updates: Partial<Order>) => Promise<void>;
  createOrder: (order: Order) => Promise<void>;

  // Repartos y Choferes
  createDelivery: (delivery: Omit<DeliveryRoute, 'id'>) => Promise<void>;
  updateDeliveryStatus: (id: string | number, status: DeliveryStatus, obs?: string) => Promise<void>;
  updateDeliveryStop: (deliveryId: string | number, clienteId: string | number, completado: boolean, horaReal?: string, motivo?: string, receptorNombre?: string, observaciones?: string) => Promise<void>;
  updateDriver: (id: string | number, updates: { nombre?: string; telefono?: string; email?: string; vehiculo?: string; activo?: boolean }) => Promise<void>;

  // Pagos
  confirmPayment: (orderId: string | number, reference?: string) => Promise<void>;
  createPaymentLog: (log: Omit<PaymentLog, 'id'>) => Promise<void>;

  // Configuración
  updateSchedule: (branchId: string | number, updates: Partial<BranchSchedule>) => Promise<void>;

  // Notificaciones
  markNotificationRead: (id: string | number) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  createSuperOffer: (offer: any, items: any[]) => Promise<void>;
  deleteSuperOffer: (id: string | number) => Promise<void>;
}

const getInitialUser = (): InternalUser | null => {
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('qca_admin_user');
      return saved ? JSON.parse(saved) : null;
    }
  } catch (_) {}
  return null;
};

export const useAdminStore = create<AdminStore>((set, get) => ({
  activeBranchId: 'all',
  currentUser: getInitialUser(),
  isLoading: true,

  branches: [],
  users: [],
  clients: [],
  products: [],
  stocks: [],
  orders: [],
  deliveries: [],
  zones: [],
  schedules: [],
  notifications: [],
  payments: [],
  superOffers: [],
  drivers: [],
  globalMinOrderAmount: 0,

  setActiveBranchId: (id) => set({ activeBranchId: id }),
  setCurrentUser: (user) => {
    try {
      if (user) {
        localStorage.setItem('qca_admin_user', JSON.stringify(user));
      } else {
        localStorage.removeItem('qca_admin_user');
      }
    } catch (_) {}
    set({ currentUser: user });
  },

  fetchData: async (silent = false) => {
    if (!silent) set({ isLoading: true });
    try {
      const state = get();
      const [branchesRes, notificationsRes] = await Promise.allSettled([
        branchService.getAll(),
        notificationService.getAll()
      ]);

      const branches = branchesRes.status === 'fulfilled' ? branchesRes.value : state.branches;
      const notifications = notificationsRes.status === 'fulfilled' ? notificationsRes.value : state.notifications;

      let schedules: BranchSchedule[] = state.schedules;
      if (!silent || schedules.length === 0) {
        try {
          const { data: schedData } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'branch_schedules')
            .maybeSingle();

          schedules = schedData ? (schedData.value as BranchSchedule[]) : [];
        } catch (_) {}
      }

      let globalMinOrderAmount = state.globalMinOrderAmount;
      if (!silent) {
        try {
          const { data: minAmountData } = await supabase
            .from('app_config')
            .select('value')
            .eq('key', 'global_order_min_amount')
            .maybeSingle();

          globalMinOrderAmount = minAmountData && minAmountData.value && typeof minAmountData.value === 'object' && 'amount' in minAmountData.value
            ? Number((minAmountData.value as any).amount || 0)
            : 0;
        } catch (_) {}
      }

      set({
        branches,
        notifications,
        schedules,
        globalMinOrderAmount,
        isLoading: false
      });
    } catch (e) {
      console.error('Error fetching base data:', e);
      set({ isLoading: false });
    }
  },

  fetchProductsOnly: async () => {
    try {
      const products = await productService.getAll();
      let stocks: ProductStock[] = [];
      try {
        const { data: invData } = await supabase.from('inventory').select('*');
        if (invData) {
          stocks = invData.map(s => ({
            productId: s.product_id,
            branchId: s.branch_id,
            stock: Number(s.stock),
            stockMinimo: Number(s.stock_minimo),
            disponible: Number(s.stock) > 0
          }));
        }
      } catch (_) {}
      set({ products, stocks });
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  },

  fetchClientsOnly: async () => {
    try {
      const clients = await clientService.getAll();
      set({ clients });
    } catch (e) {
      console.error('Error fetching clients:', e);
    }
  },

  fetchOrdersOnly: async () => {
    try {
      const orders = await orderService.getAll();
      set({ orders });
    } catch (e) {
      console.error('Error fetching orders:', e);
    }
  },

  fetchDeliveriesOnly: async () => {
    try {
      const deliveries = await deliveryService.getAll();
      let users = get().users;
      if (users.length === 0) {
        users = await userService.getAll();
      }
      const repartidorUsers = users.filter((u: any) => u.rol === 'repartidor');
      let driversMap = new Map();
      try {
        const { data: driversData } = await supabase
          .from('drivers')
          .select('id, vehiculo_info, activo');
        if (driversData) {
          driversMap = new Map(driversData.map((d: any) => [d.id, d]));
        }
      } catch (_) {}

      const drivers = repartidorUsers.map((u: any) => {
        const d = driversMap.get(u.id);
        const vehiculoInfo = d?.vehiculo_info || (u.auto ? `${u.auto}${u.patente ? ` (${u.patente})` : ''}` : 'Vehículo no asignado');
        return {
          id: u.id,
          nombre: u.nombre,
          email: u.email || '',
          rol: 'repartidor',
          branchId: u.branchId || 1,
          activo: u.activo !== false,
          telefono: u.telefono || '',
          vehiculo: vehiculoInfo,
        };
      });

      set({ deliveries, users, drivers });
    } catch (e) {
      console.error('Error fetching deliveries:', e);
    }
  },

  fetchPaymentsOnly: async () => {
    try {
      const payments = await paymentService.getAll();
      set({ payments });
    } catch (e) {
      console.error('Error fetching payments:', e);
    }
  },

  fetchUsersOnly: async () => {
    try {
      const users = await userService.getAll();
      set({ users });
    } catch (e) {
      console.error('Error fetching users:', e);
    }
  },

  fetchSuperOffersOnly: async () => {
    try {
      const superOffers = await productService.getSuperOffers();
      set({ superOffers });
    } catch (e) {
      console.error('Error fetching super offers:', e);
    }
  },

  updateBranch: async (id, updates) => {
    await branchService.update(String(id), updates);
    await get().fetchData();
  },

  createBranch: async (branch) => {
    await branchService.create(branch);
    await get().fetchData();
  },

  updateUser: async (id, updates) => {
    await userService.update(String(id), updates);
    await get().fetchData();
  },

  createUser: async (user) => {
    await userService.create(user);
    await get().fetchData();
  },

  deleteUser: async (id) => {
    const userEmail = get().currentUser?.email || '';
    await userService.delete(String(id), userEmail);
    await get().fetchData();
  },

  updateProduct: async (id, updates) => {
    // Configurar variables en base de datos para auditoría
    const userEmail = get().currentUser?.email || '';
    await supabase.rpc('set_config', { placeholder: 'app.current_user_email', value: userEmail, is_local: false });

    await productService.update(String(id), updates);
    await get().fetchData(true);
  },

  createProduct: async (product, initialStock) => {
    const userEmail = get().currentUser?.email || '';
    await productService.create(product, initialStock, userEmail);
    await get().fetchData(true);
  },

  updateBranchStock: async (productId, branchId, stock, stockMinimo, reason) => {
    const userEmail = get().currentUser?.email || '';
    await productService.updateStock(String(productId), String(branchId), stock, stockMinimo, userEmail, reason);
    await get().fetchData(true);
  },

  bulkReplaceCatalog: async (newProducts, branchId, rowStocks, fileName) => {
    const userEmail = get().currentUser?.email || '';
    
    // Registrar importación
    const { data: imp, error: impErr } = await supabase
      .from('imports')
      .insert({
        nombre_archivo: fileName,
        usuario: userEmail,
        cantidad_filas: newProducts.length,
        estado: 'procesando'
      })
      .select('*')
      .single();

    if (impErr) throw impErr;

    try {
      // Configurar variables de auditoría en la sesión
      await supabase.rpc('set_config', { placeholder: 'app.current_user_email', value: userEmail, is_local: false });

      // Eliminar catálogo actual (físico o lógico, aquí limpiamos catálogo para reemplazo integral)
      await supabase.from('products').delete().neq('id', '');

      const productsInsert = newProducts.map(p => ({
        id: p.id,
        codigo: p.codigo.trim().toUpperCase(),
        nombre: p.nombre,
        categoria: p.categoria,
        subcategoria: p.subcategoria,
        presentacion: p.presentacion,
        unidad: p.unidad,
        precio: p.precio,
        precio_mayorista: p.precioMayorista,
        descripcion: p.descripcion,
        activo: p.activo,
        visible_en_app: p.visibleEnApp,
      }));

      // Insertar por lotes
      const chunk = 100;
      for (let i = 0; i < productsInsert.length; i += chunk) {
        const batch = productsInsert.slice(i, i + chunk);
        const { error } = await supabase.from('products').insert(batch);
        if (error) throw error;
      }

      // Insertar stocks
      const movementsInsert = newProducts.map((p, idx) => {
        const stockInfo = rowStocks[idx] || { stock: 0, stockMinimo: 5 };
        return {
          product_id: p.id,
          branch_id: branchId,
          cantidad_modificada: stockInfo.stock,
          tipo_movimiento: 'importacion',
          motivo: `Carga reemplazo desde ${fileName}`,
          importacion_id: imp.id,
          usuario_responsable: userEmail
        };
      });

      for (let i = 0; i < movementsInsert.length; i += chunk) {
        const batch = movementsInsert.slice(i, i + chunk);
        const { error } = await supabase.from('inventory_movements').insert(batch);
        if (error) throw error;
      }

      // Completar importación
      await supabase
        .from('imports')
        .update({
          estado: 'completado',
          productos_creados: newProducts.length,
          productos_actualizados: 0
        })
        .eq('id', imp.id);

      await get().fetchData();
    } catch (err) {
      await supabase
        .from('imports')
        .update({
          estado: 'error',
          errores: { message: (err as Error).message }
        })
        .eq('id', imp.id);
      throw err;
    }
  },

  bulkUpdateExistingCatalog: async (updatedProducts, branchId, rowStocks, fileName) => {
    const userEmail = get().currentUser?.email || '';
    
    const { data: imp, error: impErr } = await supabase
      .from('imports')
      .insert({
        nombre_archivo: fileName,
        usuario: userEmail,
        cantidad_filas: updatedProducts.length,
        estado: 'procesando'
      })
      .select('*')
      .single();

    if (impErr) throw impErr;

    try {
      await supabase.rpc('set_config', { placeholder: 'app.current_user_email', value: userEmail, is_local: false });

      let actualizados = 0;

      for (let idx = 0; idx < updatedProducts.length; idx++) {
        const p = updatedProducts[idx];
        const stockInfo = rowStocks[idx] || { stock: 0, stockMinimo: 5 };

        // Buscar si existe por código
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('codigo', p.codigo.trim().toUpperCase())
          .maybeSingle();

        if (existing) {
          // Actualizar producto
          await supabase
            .from('products')
            .update({
              nombre: p.nombre,
              categoria: p.categoria,
              subcategoria: p.subcategoria,
              presentacion: p.presentacion,
              unidad: p.unidad,
              precio: p.precio,
              precio_mayorista: p.precioMayorista,
              descripcion: p.descripcion,
              activo: p.activo,
              visible_en_app: p.visibleEnApp,
            })
            .eq('id', existing.id);

          // Actualizar Stock
          await productService.updateStock(String(existing.id), String(branchId), stockInfo.stock, stockInfo.stockMinimo, userEmail);
          actualizados++;
        }
      }

      await supabase
        .from('imports')
        .update({
          estado: 'completado',
          productos_actualizados: actualizados,
          productos_creados: 0
        })
        .eq('id', imp.id);

      await get().fetchData();
    } catch (err) {
      await supabase
        .from('imports')
        .update({ estado: 'error', errores: { message: (err as Error).message } })
        .eq('id', imp.id);
      throw err;
    }
  },

  bulkAddNewCatalog: async (newProducts, branchId, rowStocks, fileName) => {
    const userEmail = get().currentUser?.email || '';
    
    const { data: imp, error: impErr } = await supabase
      .from('imports')
      .insert({
        nombre_archivo: fileName,
        usuario: userEmail,
        cantidad_filas: newProducts.length,
        estado: 'procesando'
      })
      .select('*')
      .single();

    if (impErr) throw impErr;

    try {
      await supabase.rpc('set_config', { placeholder: 'app.current_user_email', value: userEmail, is_local: false });

      let creados = 0;

      for (let idx = 0; idx < newProducts.length; idx++) {
        const p = newProducts[idx];
        const stockInfo = rowStocks[idx] || { stock: 0, stockMinimo: 5 };

        // Verificar que no exista el código
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('codigo', p.codigo.trim().toUpperCase())
          .maybeSingle();

        if (!existing) {
          // Crear
          await productService.create(
            {
              codigo: p.codigo,
              nombre: p.nombre,
              categoria: p.categoria,
              subcategoria: p.subcategoria,
              presentacion: p.presentacion,
              unidad: p.unidad,
              precio: p.precio,
              precioMayorista: p.precioMayorista,
              descripcion: p.descripcion,
              activo: p.activo,
              visibleEnApp: p.visibleEnApp,
            },
            { [branchId]: stockInfo.stock },
            userEmail
          );
          creados++;
        }
      }

      await supabase
        .from('imports')
        .update({
          estado: 'completado',
          productos_creados: creados,
          productos_actualizados: 0
        })
        .eq('id', imp.id);

      await get().fetchData();
    } catch (err) {
      await supabase
        .from('imports')
        .update({ estado: 'error', errores: { message: (err as Error).message } })
        .eq('id', imp.id);
      throw err;
    }
  },

  checkFileHashExists: async (hash) => {
    return await productService.checkFileHashExists(hash);
  },

  checkDuplicateImport: async (fileName, hash) => {
    return await productService.checkDuplicateImport(fileName, hash);
  },

  fetchImportsHistory: async (limit = 20) => {
    return await productService.getImportsHistory(limit);
  },

  createStagingImport: async (fileName, fileHash, stagedRowsCount) => {
    const userEmail = get().currentUser?.email || '';
    return await productService.createStagingImport(fileName, userEmail, fileHash, stagedRowsCount);
  },

  insertStagingRows: async (importId, rows) => {
    await productService.insertStagingRows(String(importId), rows);
  },

  updateStagingRow: async (rowId, updates) => {
    await productService.updateStagingRow(String(rowId), updates);
  },

  confirmImport: async (importId, branchId) => {
    const userEmail = get().currentUser?.email || '';
    const result = await productService.confirmImport(String(importId), String(branchId), userEmail);
    await get().fetchData(true);
    return result;
  },

  updateClient: async (id, updates) => {
    await clientService.update(String(id), updates);
    await get().fetchData();
  },

  createClient: async (client) => {
    await clientService.create(client);
    await get().fetchData();
  },

  updateOrderStatus: async (id, status, notes, clientNotes) => {
    const userEmail = get().currentUser?.email || '';
    await orderService.update(String(id), {
      estado: status,
      observaciones: notes,
      observacionesCliente: clientNotes,
      paymentStatus: status === 'entregado' ? 'pagado' : undefined
    }, userEmail);
    await get().fetchData();
  },

  updateOrder: async (id, updates) => {
    const userEmail = get().currentUser?.email || '';
    await orderService.update(String(id), updates as any, userEmail);
    await get().fetchData();
  },

  createOrder: async (order) => {
    const userEmail = get().currentUser?.email || '';
    await orderService.create(order as any, userEmail);
    await get().fetchData();
  },

  createDelivery: async (delivery) => {
    await deliveryService.create(delivery);
    await get().fetchData();
  },

  updateDeliveryStatus: async (id, status, obs) => {
    await deliveryService.updateStatus(String(id), status, obs);
    await get().fetchData();
  },

  updateDeliveryStop: async (deliveryId, clienteId, completado, horaReal, motivo, receptorNombre, observaciones) => {
    const userEmail = get().currentUser?.email || '';
    await deliveryService.updateStop(String(deliveryId), String(clienteId), completado, horaReal, motivo, receptorNombre, observaciones, userEmail);
    await get().fetchData();
  },

  updateDriver: async (id, updates) => {
    try {
      // 1. Actualizar tabla profiles
      if (updates.nombre || updates.telefono || updates.email) {
        await supabase
          .from('profiles')
          .update({
            nombre: updates.nombre,
            telefono: updates.telefono,
            email: updates.email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      }

      // 2. Actualizar o insertar en tabla drivers (sin updated_at)
      if (updates.vehiculo !== undefined || updates.activo !== undefined) {
        await supabase
          .from('drivers')
          .upsert({
            id: id,
            vehiculo_info: updates.vehiculo,
            activo: updates.activo ?? true,
          });
      }

      // 3. Actualizar tabla auth.users email si cambió (va por separate call)
      if (updates.nombre || updates.telefono || updates.email) {
        // No tocamos auth.users desde el cliente para no romper las sesiones
        // El email se actualiza sólo en profiles (usado como credencial de login en la app)
      }
    } catch (e) {
      console.warn('Error updating driver:', e);
    }
    await get().fetchData();
  },

  confirmPayment: async (orderId, reference) => {
    const userEmail = get().currentUser?.email || '';
    // Buscar el log de pago correspondiente
    const { data: payLog } = await supabase
      .from('payment_logs')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (payLog) {
      await paymentService.updateStatus(payLog.id, 'pagado');
    } else {
      // Crear uno nuevo
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (order) {
        await paymentService.create({
          orderId: String(orderId),
          branchId: String(order.branch_id),
          fecha: new Date().toISOString(),
          monto: Number(order.total),
          metodo: order.payment_method,
          estado: 'pagado',
          referenciaMock: reference,
        });
      }
    }
    await get().fetchData();
  },

  createPaymentLog: async (log) => {
    await paymentService.create(log);
    await get().fetchData();
  },

  updateSchedule: async (branchId, updates) => {
    const currentSchedules = get().schedules;
    let exists = false;
    let nextSchedules = currentSchedules.map(s => {
      if (String(s.branchId) === String(branchId)) {
        exists = true;
        return { ...s, ...updates };
      }
      return s;
    });

    if (!exists) {
      nextSchedules.push({
        id: `sched-${branchId}`,
        branchId: String(branchId),
        horariosAtencion: updates.horariosAtencion || [],
        horariosRetiro: updates.horariosRetiro || [],
        diasSinReparto: updates.diasSinReparto || [],
        feriados: updates.feriados || [],
        fechasBloqueadas: updates.fechasBloqueadas || [],
      });
    }

    const userEmail = get().currentUser?.email || '';
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'branch_schedules',
        value: nextSchedules,
        updated_by: userEmail,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    await get().fetchData();
  },

  markNotificationRead: async (id) => {
    await notificationService.markAsRead(String(id));
    await get().fetchData();
  },

  markAllNotificationsRead: async () => {
    const branchId = get().activeBranchId;
    await notificationService.markAllAsRead(branchId === 'all' ? undefined : String(branchId));
    await get().fetchData();
  },

  createSuperOffer: async (offer, items) => {
    await productService.createSuperOffer(offer, items);
    await get().fetchData(true);
  },

  deleteSuperOffer: async (id) => {
    await productService.deleteSuperOffer(String(id));
    await get().fetchData(true);
  },

  updateGlobalMinOrderAmount: async (amount) => {
    const { error } = await supabase
      .from('app_config')
      .upsert({
        key: 'global_order_min_amount',
        value: { amount: Number(amount) },
        updated_by: get().currentUser?.email || '',
        updated_at: new Date().toISOString(),
      });
    if (error) throw error;
    await get().fetchData(true);
  }
}));
