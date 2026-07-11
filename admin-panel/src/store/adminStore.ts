import { create } from 'zustand';
import {
  Branch,
  Sector,
  InternalUser,
  Customer,
  Product,
  ProductStock,
  Order,
  DeliveryRoute,
  DeliveryStatus,
  DeliveryStop,
  OrderStatus,
  DeliveryZone,
  BranchSchedule,
  InternalNotification,
  PaymentLog,
} from '@shared/types';
import {
  branchService,
  sectorService,
  userService,
  clientService,
  productService,
  orderService,
  deliveryService,
  paymentService,
  notificationService,
  supabase
} from '@shared/services';

interface AdminStore {
  // Estado activo
  activeBranchId: string | 'all';
  currentUser: InternalUser | null;
  isLoading: boolean;
  
  // Tablas
  branches: Branch[];
  sectors: Sector[];
  users: InternalUser[];
  clients: Customer[];
  products: Product[];
  stocks: ProductStock[];
  orders: Order[];
  deliveries: DeliveryRoute[];
  zones: DeliveryZone[];
  schedules: BranchSchedule[];
  notifications: InternalNotification[];
  payments: PaymentLog[];

  // Acciones globales
  setActiveBranchId: (id: string | 'all') => void;
  setCurrentUser: (user: InternalUser | null) => void;
  fetchData: () => Promise<void>;
  
  // Sucursales
  updateBranch: (id: string, updates: Partial<Branch>) => Promise<void>;
  createBranch: (branch: Omit<Branch, 'id'>) => Promise<void>;
  
  // Sectores
  updateSector: (id: string, updates: Partial<Sector>) => Promise<void>;
  createSector: (sector: Omit<Sector, 'id'>) => Promise<void>;
  
  // Usuarios
  updateUser: (id: string, updates: Partial<InternalUser>) => Promise<void>;
  createUser: (user: Omit<InternalUser, 'id'>) => Promise<void>;
  
  // Productos & Stock
  updateProduct: (id: string, updates: Partial<Product> & { dolarizado?: boolean; precio_usd?: number }) => Promise<void>;
  createProduct: (product: Omit<Product, 'id'> & { dolarizado?: boolean; precio_usd?: number }, initialStock: Record<string, number>) => Promise<void>;
  updateBranchStock: (productId: string, branchId: string, stock: number, stockMinimo: number) => Promise<void>;
  bulkReplaceCatalog: (newProducts: Product[], branchId: string, rowStocks: any, fileName: string) => Promise<void>;
  bulkUpdateExistingCatalog: (updatedProducts: Product[], branchId: string, rowStocks: any, fileName: string) => Promise<void>;
  bulkAddNewCatalog: (newProducts: Product[], branchId: string, rowStocks: any, fileName: string) => Promise<void>;
  
  // Clientes
  updateClient: (id: string, updates: Partial<Customer>) => Promise<void>;
  createClient: (client: Omit<Customer, 'id' | 'fechaAlta'>) => Promise<void>;

  // Pedidos
  updateOrderStatus: (id: string, status: OrderStatus, notes?: string, clientNotes?: string) => Promise<void>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<void>;
  createOrder: (order: Order) => Promise<void>;

  // Repartos
  createDelivery: (delivery: Omit<DeliveryRoute, 'id'>) => Promise<void>;
  updateDeliveryStatus: (id: string, status: DeliveryStatus, obs?: string) => Promise<void>;
  updateDeliveryStop: (deliveryId: string, clienteId: string, completado: boolean, horaReal?: string, motivo?: string, receptorNombre?: string, observaciones?: string) => Promise<void>;

  // Pagos
  confirmPayment: (orderId: string, reference?: string) => Promise<void>;
  createPaymentLog: (log: Omit<PaymentLog, 'id'>) => Promise<void>;

  // Configuración
  updateZone: (id: string, updates: Partial<DeliveryZone>) => Promise<void>;
  createZone: (zone: Omit<DeliveryZone, 'id'>) => Promise<void>;
  updateSchedule: (branchId: string, updates: Partial<BranchSchedule>) => Promise<void>;

  // Notificaciones
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  activeBranchId: 'all',
  currentUser: null,
  isLoading: true,

  branches: [],
  sectors: [],
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

  setActiveBranchId: (id) => set({ activeBranchId: id }),
  setCurrentUser: (user) => set({ currentUser: user }),

  fetchData: async () => {
    set({ isLoading: true });
    try {
      const [
        branches,
        sectors,
        users,
        clients,
        products,
        orders,
        deliveries,
        payments,
        notifications
      ] = await Promise.all([
        branchService.getAll(),
        sectorService.getAll(),
        userService.getAll(),
        clientService.getAll(),
        productService.getAll(), // Hydrates catalog with stock in default sucursal
        orderService.getAll(),
        deliveryService.getAll(),
        paymentService.getAll(),
        notificationService.getAll()
      ]);

      // Load stocks directly
      const { data: invData, error: invErr } = await supabase.from('inventory').select('*');
      if (invErr) throw invErr;

      const stocks: ProductStock[] = (invData || []).map(s => ({
        productId: s.product_id,
        branchId: s.branch_id,
        stock: Number(s.stock),
        stockMinimo: Number(s.stock_minimo),
        disponible: Number(s.stock) > 0
      }));

      // Load delivery zones
      const { data: zonesData, error: zonesErr } = await supabase.from('delivery_zones').select('*');
      if (zonesErr) throw zonesErr;

      const zones: DeliveryZone[] = (zonesData || []).map(z => ({
        id: z.id,
        branchId: z.branch_id,
        nombre: z.nombre,
        costoEnvio: Number(z.costo_envio || 0),
        pedidoMinimo: Number(z.pedido_minimo || 0),
        diasReparto: z.dias_reparto || [],
        horarioEntrega: z.horario_entrega || '',
        activo: z.activo ?? true,
      }));

      // Load schedules from system settings
      const { data: schedData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'branch_schedules')
        .maybeSingle();

      const schedules = schedData ? (schedData.value as BranchSchedule[]) : [];

      set({
        branches,
        sectors,
        users,
        clients,
        products,
        stocks,
        orders,
        deliveries,
        zones,
        schedules,
        payments,
        notifications,
        isLoading: false
      });
    } catch (e) {
      console.error('Error fetching data from Supabase:', e);
      set({ isLoading: false });
    }
  },

  updateBranch: async (id, updates) => {
    await branchService.update(id, updates);
    await get().fetchData();
  },

  createBranch: async (branch) => {
    await branchService.create(branch);
    await get().fetchData();
  },

  updateSector: async (id, updates) => {
    await sectorService.update(id, updates);
    await get().fetchData();
  },

  createSector: async (sector) => {
    await sectorService.create(sector);
    await get().fetchData();
  },

  updateUser: async (id, updates) => {
    await userService.update(id, updates);
    await get().fetchData();
  },

  createUser: async (user) => {
    await userService.create(user);
    await get().fetchData();
  },

  updateProduct: async (id, updates) => {
    // Configurar variables en base de datos para auditoría
    const userEmail = get().currentUser?.email || 'admin@quimicadeheza.com';
    await supabase.rpc('set_config', { placeholder: 'app.current_user_email', value: userEmail, is_local: false });

    await productService.update(id, updates);
    await get().fetchData();
  },

  createProduct: async (product, initialStock) => {
    const userEmail = get().currentUser?.email || 'admin@quimicadeheza.com';
    await productService.create(product, initialStock, userEmail);
    await get().fetchData();
  },

  updateBranchStock: async (productId, branchId, stock, stockMinimo) => {
    const userEmail = get().currentUser?.email || 'admin@quimicadeheza.com';
    await productService.updateStock(productId, branchId, stock, stockMinimo, userEmail);
    await get().fetchData();
  },

  bulkReplaceCatalog: async (newProducts, branchId, rowStocks, fileName) => {
    const userEmail = get().currentUser?.email || 'admin@quimicadeheza.com';
    
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
    const userEmail = get().currentUser?.email || 'admin@quimicadeheza.com';
    
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
          await productService.updateStock(existing.id, branchId, stockInfo.stock, stockInfo.stockMinimo, userEmail);
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
    const userEmail = get().currentUser?.email || 'admin@quimicadeheza.com';
    
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

  updateClient: async (id, updates) => {
    await clientService.update(id, updates);
    await get().fetchData();
  },

  createClient: async (client) => {
    await clientService.create(client);
    await get().fetchData();
  },

  updateOrderStatus: async (id, status, notes, clientNotes) => {
    const userEmail = get().currentUser?.email || 'admin@quimicadeheza.com';
    await orderService.update(id, {
      estado: status,
      observaciones: notes,
      observacionesCliente: clientNotes,
      paymentStatus: status === 'entregado' ? 'pagado' : undefined
    }, userEmail);
    await get().fetchData();
  },

  updateOrder: async (id, updates) => {
    const userEmail = get().currentUser?.email || 'admin@quimicadeheza.com';
    await orderService.update(id, updates, userEmail);
    await get().fetchData();
  },

  createOrder: async (order) => {
    const userEmail = get().currentUser?.email || 'admin@quimicadeheza.com';
    await orderService.create(order, userEmail);
    await get().fetchData();
  },

  createDelivery: async (delivery) => {
    await deliveryService.create(delivery);
    await get().fetchData();
  },

  updateDeliveryStatus: async (id, status, obs) => {
    await deliveryService.updateStatus(id, status, obs);
    await get().fetchData();
  },

  updateDeliveryStop: async (deliveryId, clienteId, completado, horaReal, motivo, receptorNombre, observaciones) => {
    const userEmail = get().currentUser?.email || 'admin@quimicadeheza.com';
    await deliveryService.updateStop(deliveryId, clienteId, completado, horaReal, motivo, receptorNombre, observaciones, userEmail);
    await get().fetchData();
  },

  confirmPayment: async (orderId, reference) => {
    const userEmail = get().currentUser?.email || 'admin@quimicadeheza.com';
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
          orderId,
          branchId: order.branch_id,
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

  updateZone: async (id, updates) => {
    const dbUpdates = {
      nombre: updates.nombre,
      descripcion: updates.descripcion,
      branch_id: updates.branchId,
      activo: updates.activo,
      costo_envio: updates.costoEnvio,
      pedido_minimo: updates.pedidoMinimo,
      dias_reparto: updates.diasReparto,
      horario_entrega: updates.horarioEntrega,
    };

    Object.keys(dbUpdates).forEach(key => (dbUpdates as any)[key] === undefined && delete (dbUpdates as any)[key]);

    const { error } = await supabase
      .from('delivery_zones')
      .update(dbUpdates)
      .eq('id', id);

    if (error) throw error;
    await get().fetchData();
  },

  createZone: async (zone) => {
    const zoneId = zone.id || `zone-${Date.now()}`;
    const dbInsert = {
      id: zoneId,
      branch_id: zone.branchId,
      nombre: zone.nombre,
      descripcion: zone.descripcion,
      activo: zone.activo ?? true,
      costo_envio: zone.costoEnvio,
      pedido_minimo: zone.pedidoMinimo,
      dias_reparto: zone.diasReparto,
      horario_entrega: zone.horarioEntrega,
    };

    const { error } = await supabase
      .from('delivery_zones')
      .insert(dbInsert);

    if (error) throw error;
    await get().fetchData();
  },

  updateSchedule: async (branchId, updates) => {
    const currentSchedules = get().schedules;
    let exists = false;
    let nextSchedules = currentSchedules.map(s => {
      if (s.branchId === branchId) {
        exists = true;
        return { ...s, ...updates };
      }
      return s;
    });

    if (!exists) {
      nextSchedules.push({
        id: `sched-${branchId}`,
        branchId,
        horariosAtencion: updates.horariosAtencion || [],
        horariosRetiro: updates.horariosRetiro || [],
        diasSinReparto: updates.diasSinReparto || [],
        feriados: updates.feriados || [],
        fechasBloqueadas: updates.fechasBloqueadas || [],
      });
    }

    const userEmail = get().currentUser?.email || 'admin@quimicadeheza.com';
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
    await notificationService.markAsRead(id);
    await get().fetchData();
  },

  markAllNotificationsRead: async () => {
    const branchId = get().activeBranchId;
    await notificationService.markAllAsRead(branchId === 'all' ? undefined : branchId);
    await get().fetchData();
  }
}));
