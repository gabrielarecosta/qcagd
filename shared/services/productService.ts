import { supabase } from './supabaseClient';
import { Product, ProductStock, ProductCategory } from '../types/product';

const mapProduct = (d: any, rate: number = 1000, isPublic: boolean = false): Product => {
  const isDolarizado = isPublic ? false : (d.dolarizado || false);
  const precioUsd = isPublic ? 0.0 : Number(d.precio_usd || 0.0);
  const precioArs = isPublic ? 0.0 : (isDolarizado ? Math.round(precioUsd * rate * 100) / 100 : Number(d.precio || 0.0));

  return {
    id: d.id,
    codigo: d.codigo,
    nombre: d.nombre,
    categoria: d.categoria as ProductCategory,
    subcategoria: d.subcategoria || undefined,
    presentacion: d.presentacion,
    unidad: d.unidad || 'unidad',
    precio: precioArs,
    precioMayorista: isPublic ? undefined : (d.precio_mayorista ? Number(d.precio_mayorista) : undefined),
    descripcion: d.descripcion || undefined,
    imagen: d.imagen || undefined,
    activo: d.activo,
    visibleEnApp: d.visible_en_app,
    destacado: d.destacado || false,
    fechaActualizacion: d.updated_at,
    marca: d.marca || undefined,
  };
};

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductQueryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  categoria?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isPublic?: boolean;
  branchId?: string | number;
  photoFilter?: 'all' | 'no-photo';
  activeStatusFilter?: 'all' | 'active' | 'inactive';
}

export const productService = {
  getLatestExchangeRate: async (): Promise<number> => {
    const { data, error } = await supabase
      .from('exchange_rates')
      .select('valor_nuevo')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('Error fetching exchange rate, using 1000 fallback:', error);
      return 1000;
    }
    return data ? Number(data.valor_nuevo) : 1000;
  },

  getPaginated: async (options: ProductQueryOptions = {}): Promise<PaginatedResult<Product & { stock: number; stockMinimo: number }>> => {
    const page = options.page || 1;
    const pageSize = options.pageSize || 24;
    const fromRange = (page - 1) * pageSize;
    const toRange = fromRange + pageSize - 1;
    const isPublic = !!options.isPublic;

    const rate = await productService.getLatestExchangeRate();

    let query = supabase
      .from('products')
      .select(
        isPublic
          ? 'id, codigo, nombre, categoria, subcategoria, presentacion, unidad, descripcion, imagen, activo, visible_en_app, destacado, created_at, updated_at, deleted_at, deleted_by'
          : '*',
        { count: 'exact' }
      )
      .is('deleted_at', null);

    // Solo filtrar por activo=true si es público o si el filtro indica únicamente activos
    if (isPublic || options.activeStatusFilter === 'active') {
      query = query.eq('activo', true);
    } else if (options.activeStatusFilter === 'inactive') {
      query = query.or('activo.is.null,activo.eq.false');
    }

    // Filtro por productos sin foto (para vista Admin)
    if (options.photoFilter === 'no-photo') {
      query = query.or('imagen.is.null,imagen.eq.');
    }

    // 1. Filtrar por categoría
    if (options.categoria && options.categoria !== 'todos' && options.categoria !== 'all') {
      query = query.eq('categoria', options.categoria);
    }

    // 2. Búsqueda por texto (nombre, código, descripción, presentación)
    if (options.search && options.search.trim()) {
      const q = options.search.trim();
      query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%,descripcion.ilike.%${q}%,presentacion.ilike.%${q}%`);
    }

    // 3. Ordenamiento del lado de Supabase
    const asc = options.sortOrder !== 'desc';
    if (options.sortBy === 'precio-bajo') {
      query = query.order('precio', { ascending: true });
    } else if (options.sortBy === 'precio-alto') {
      query = query.order('precio', { ascending: false });
    } else if (options.sortBy === 'mas-vendido') {
      query = query.order('id', { ascending: true });
    } else if (options.sortBy === 'code') {
      query = query.order('codigo', { ascending: asc });
    } else if (options.sortBy === 'price') {
      query = query.order('precio', { ascending: asc });
    } else if (options.sortBy === 'category') {
      query = query.order('categoria', { ascending: asc });
    } else if (options.sortBy === 'name') {
      query = query.order('nombre', { ascending: asc });
    } else {
      query = query
        .order('destacado', { ascending: false })
        .order('nombre', { ascending: true });
    }

    // 4. Paginación server-side con range
    query = query.range(fromRange, toRange);

    const { data: chunk, count, error } = await query;

    if (error) {
      console.error('Error en consulta paginada de productos:', error.message);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    const total = count ?? (chunk ? chunk.length : 0);
    const totalPages = Math.ceil(total / pageSize) || 1;

    // Cargar inventario únicamente para los productos devueltos en esta página
    const prodIds = (chunk || []).map((p: any) => p.id);
    let stocksMap = new Map();
    if (prodIds.length > 0) {
      try {
        const { data: stockData } = await supabase
          .from('inventory')
          .select('*')
          .in('product_id', prodIds);
        if (stockData) {
          stockData.forEach((s: any) => {
            stocksMap.set(String(s.product_id), s);
          });
        }
      } catch (_) {}
    }

    const mapped = (chunk || []).map((p: any) => {
      const stockInfo = stocksMap.get(String(p.id));
      return {
        ...mapProduct(p, rate, isPublic),
        stock: stockInfo ? Number(stockInfo.stock) : 0,
        stockMinimo: stockInfo ? Number(stockInfo.stock_minimo) : 0,
      };
    });

    return {
      data: mapped,
      total,
      page,
      pageSize,
      totalPages,
    };
  },

  getAll: async (branchId?: string, isPublic?: boolean): Promise<(Product & { stock: number; stockMinimo: number })[]> => {
    const rate = await productService.getLatestExchangeRate();
    const pageSize = 1000;

    // 1. Obtener todos los productos paginados (evitando límite de 1000)
    let prods: any[] = [];
    let hasMoreProds = true;
    let prodPage = 0;

    while (hasMoreProds) {
      const fromRange = prodPage * pageSize;
      const toRange = fromRange + pageSize - 1;

      const { data: chunk, error: prodErr } = await supabase
        .from('products')
        .select(isPublic ? 'id, codigo, nombre, categoria, subcategoria, presentacion, unidad, descripcion, imagen, activo, visible_en_app, destacado, created_at, updated_at, deleted_at, deleted_by' : '*')
        .is('deleted_at', null)
        .range(fromRange, toRange);

      if (prodErr) {
        console.error('Error cargando productos:', prodErr.message);
        break;
      }

      if (!chunk || chunk.length === 0) {
        hasMoreProds = false;
      } else {
        prods = prods.concat(chunk);
        if (chunk.length < pageSize) {
          hasMoreProds = false;
        } else {
          prodPage++;
        }
      }
    }

    const targetBranch = branchId && branchId !== 'all' ? branchId : 1;

    // 2. Obtener todo el inventario paginado para la sucursal (evitando límite de 1000)
    let stocks: any[] = [];
    let hasMoreStocks = true;
    let stockPage = 0;

    while (hasMoreStocks) {
      const fromRange = stockPage * pageSize;
      const toRange = fromRange + pageSize - 1;

      const { data: chunk, error: stockErr } = await supabase
        .from('inventory')
        .select('*')
        .eq('branch_id', targetBranch)
        .range(fromRange, toRange);

      if (stockErr) throw stockErr;

      if (!chunk || chunk.length === 0) {
        hasMoreStocks = false;
      } else {
        stocks = stocks.concat(chunk);
        if (chunk.length < pageSize) {
          hasMoreStocks = false;
        } else {
          stockPage++;
        }
      }
    }

    return (prods || []).map((p: any) => {
      const stockInfo = (stocks || []).find((s: any) => String(s.product_id) === String(p.id));
      return {
        ...mapProduct(p, rate, isPublic),
        stock: stockInfo ? Number(stockInfo.stock) : 0,
        stockMinimo: stockInfo ? Number(stockInfo.stock_minimo) : 5,
      };
    });
  },

  getById: async (id: string, branchId?: string): Promise<(Product & { stock: number; stockMinimo: number }) | undefined> => {
    const rate = await productService.getLatestExchangeRate();
    const { data: p, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (prodErr) throw prodErr;
    if (!p) return undefined;

    const targetBranch = branchId && branchId !== 'all' ? branchId : 1;
    const { data: stockInfo, error: stockErr } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', id)
      .eq('branch_id', targetBranch)
      .maybeSingle();

    if (stockErr) throw stockErr;

    return {
      ...mapProduct(p, rate),
      stock: stockInfo ? Number(stockInfo.stock) : 0,
      stockMinimo: stockInfo ? Number(stockInfo.stock_minimo) : 5,
    };
  },

  create: async (
    product: Omit<Product, 'id'> & { dolarizado?: boolean; precio_usd?: number },
    initialStockPerBranch: Record<string, number> = {},
    userMail?: string
  ): Promise<Product> => {
    const rate = await productService.getLatestExchangeRate();
    
    // Normalizar código
    const normalizedCode = product.codigo.trim().toUpperCase();

    const dbInsert: any = {
      codigo: normalizedCode,
      nombre: product.nombre,
      categoria: product.categoria,
      subcategoria: product.subcategoria,
      presentacion: product.presentacion,
      unidad: product.unidad || 'unidad',
      precio: product.precio ?? 0.0,
      precio_mayorista: product.precioMayorista,
      descripcion: product.descripcion,
      imagen: product.imagen,
      activo: product.activo ?? true,
      visible_en_app: product.visibleEnApp ?? true,
      destacado: product.destacado ?? false,
      dolarizado: product.dolarizado ?? false,
      precio_usd: product.precio_usd ?? 0.0,
    };

    // Execute in a query
    const { data, error } = await supabase
      .from('products')
      .insert(dbInsert)
      .select('*')
      .single();

    if (error) throw error;

    const createdProductId = data.id;

    // Crear movimientos de stock iniciales
    const branchesToInit = [1, 2, 3, 4];
    for (const bId of branchesToInit) {
      const qty = initialStockPerBranch[bId] ?? 0;
      // Inserción en inventory_movements actualizará la tabla inventory por trigger
      const { error: stockErr } = await supabase
        .from('inventory_movements')
        .insert({
          product_id: createdProductId,
          branch_id: bId,
          cantidad_modificada: qty,
          tipo_movimiento: 'carga_inicial',
          motivo: 'Carga inicial en creación de producto',
          usuario_responsable: userMail || ''
        });
      if (stockErr) {
        console.error(`Failed to seed stock for branch ${bId} on product ${createdProductId}:`, stockErr);
      }
    }

    return mapProduct(data, rate);
  },

  update: async (id: string | number, updates: Partial<Product> & { dolarizado?: boolean; precio_usd?: number }): Promise<Product> => {
    const rate = await productService.getLatestExchangeRate();
    const dbUpdates: any = {
      codigo: updates.codigo ? updates.codigo.trim().toUpperCase() : undefined,
      nombre: updates.nombre,
      categoria: updates.categoria,
      subcategoria: updates.subcategoria,
      presentacion: updates.presentacion,
      unidad: updates.unidad,
      precio: updates.precio,
      precio_mayorista: updates.precioMayorista,
      descripcion: updates.descripcion,
      imagen: updates.imagen,
      activo: updates.activo,
      visible_en_app: updates.visibleEnApp,
      destacado: updates.destacado,
      dolarizado: updates.dolarizado,
      precio_usd: updates.precio_usd,
      updated_at: new Date().toISOString(),
    };

    Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

    const { data, error } = await supabase
      .from('products')
      .update(dbUpdates)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return mapProduct(data, rate);
  },

  updateStock: async (productId: string, branchId: string, qty: number, minQty?: number, userMail?: string, reason?: string): Promise<ProductStock> => {
    const { data: inv } = await supabase
      .from('inventory')
      .select('stock, stock_minimo')
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .maybeSingle();

    const currentStock = inv ? Number(inv.stock) : 0;
    const stockMinimo = minQty !== undefined ? minQty : (inv ? Number(inv.stock_minimo) : 5);
    const diff = qty - currentStock;

    // Actualizar stock mínimo si es necesario
    if (minQty !== undefined || !inv) {
      const { error: invErr } = await supabase
        .from('inventory')
        .upsert({
          product_id: productId,
          branch_id: branchId,
          stock_minimo: stockMinimo,
          updated_at: new Date().toISOString()
        }, { onConflict: 'product_id,branch_id' });
      if (invErr) throw invErr;
    }

    // Registrar movimiento si el stock cambia
    if (diff !== 0) {
      const { error: moveErr } = await supabase
        .from('inventory_movements')
        .insert({
          product_id: productId,
          branch_id: branchId,
          cantidad_modificada: diff,
          tipo_movimiento: 'ajuste_manual',
          motivo: reason || 'Ajuste manual de stock desde el panel',
          usuario_responsable: userMail || ''
        });
      if (moveErr) throw moveErr;
    }

    return {
      productId,
      branchId,
      stock: qty,
      stockMinimo,
      disponible: qty > 0
    };
  },

  delete: async (id: string, deletedBy?: string): Promise<boolean> => {
    const { error } = await supabase
      .from('products')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: deletedBy || 'admin',
        activo: false
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  updateExchangeRate: async (newVal: number, userMail?: string): Promise<void> => {
    const oldVal = await productService.getLatestExchangeRate();
    if (oldVal === newVal) return;

    // Registrar en historial de exchange_rates
    const { error } = await supabase
      .from('exchange_rates')
      .insert({
        valor_anterior: oldVal,
        valor_nuevo: newVal,
        usuario_responsable: userMail || ''
      });
    if (error) throw error;
  },

  checkFileHashExists: async (hash: string): Promise<any | null> => {
    const { data, error } = await supabase
      .from('imports')
      .select('*')
      .eq('file_hash', hash)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  checkDuplicateImport: async (fileName: string, hash: string): Promise<any | null> => {
    try {
      if (hash) {
        const { data: byHash } = await supabase
          .from('imports')
          .select('*')
          .eq('file_hash', hash)
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byHash) return { ...byHash, matchReason: 'content' };
      }

      if (fileName) {
        const { data: byName } = await supabase
          .from('imports')
          .select('*')
          .eq('nombre_archivo', fileName)
          .order('fecha', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byName) return { ...byName, matchReason: 'name' };
      }
    } catch (err) {
      console.warn('Error verificando duplicidad de importación:', err);
    }
    return null;
  },

  getImportsHistory: async (limit = 20): Promise<any[]> => {
    const { data, error } = await supabase
      .from('imports')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(limit);
    if (error) {
      console.warn('Error obteniendo historial de importaciones:', error.message);
      return [];
    }
    return data || [];
  },

  createStagingImport: async (fileName: string, userEmail: string, fileHash: string, stagedRowsCount: number): Promise<any> => {
    const payload: any = {
      nombre_archivo: fileName,
      usuario: userEmail,
      cantidad_filas: stagedRowsCount,
      file_hash: fileHash,
      estado: 'uploaded'
    };

    let { data, error } = await supabase
      .from('imports')
      .insert(payload)
      .select('*')
      .single();

    if (error && (error.message?.includes('file_hash') || error.code === 'PGRST204')) {
      delete payload.file_hash;
      const { data: retryData, error: retryErr } = await supabase
        .from('imports')
        .insert(payload)
        .select('*')
        .single();
      if (retryErr) {
        if (retryErr.message?.includes('imports_estado_check')) {
          payload.estado = 'procesando';
          const { data: retry2, error: err2 } = await supabase.from('imports').insert(payload).select('*').single();
          if (err2) throw err2;
          data = retry2;
        } else {
          throw retryErr;
        }
      } else {
        data = retryData;
      }
    } else if (error && error.message?.includes('imports_estado_check')) {
      payload.estado = 'procesando';
      const { data: retryData, error: retryErr } = await supabase
        .from('imports')
        .insert(payload)
        .select('*')
        .single();
      if (retryErr) throw retryErr;
      data = retryData;
    } else if (error) {
      throw error;
    }
    return data;
  },

  insertStagingRows: async (importId: string, rows: any[]): Promise<void> => {
    const records = rows.map(r => {
      let status = r.estado;
      if (status === 'valido') status = 'exitoso';
      if (status === 'invalid') status = 'error';
      return {
        import_id: importId,
        fila_numero: r.filaNumero,
        datos: r,
        estado: status || 'exitoso',
        error_detalle: r.validationErrors ? r.validationErrors.join(', ') : null
      };
    });

    // Inserción en lotes de 100 para evitar desbordar payloads
    const chunkSize = 100;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error } = await supabase.from('import_rows').insert(chunk);
      if (error) throw error;
    }
  },

  updateStagingRow: async (rowId: string, updates: { estado: string; datos: any }): Promise<void> => {
    const { error } = await supabase
      .from('import_rows')
      .update({
        estado: updates.estado,
        datos: updates.datos,
        error_detalle: updates.datos.validationErrors ? updates.datos.validationErrors.join(', ') : null
      })
      .eq('id', rowId);
    if (error) throw error;
  },

  confirmImport: async (importId: string, rawBranchId: string | number, userEmail: string): Promise<any> => {
    // Normalizar branchId a entero BIGINT
    let branchId: number;
    if (typeof rawBranchId === 'number') {
      branchId = rawBranchId;
    } else {
      const parsed = parseInt(String(rawBranchId), 10);
      if (!isNaN(parsed)) {
        branchId = parsed;
      } else {
        if (rawBranchId === 'branch-gd2') branchId = 2;
        else if (rawBranchId === 'branch-rc') branchId = 3;
        else if (rawBranchId === 'branch-gig') branchId = 4;
        else branchId = 1;
      }
    }

    // 1. Cambiar estado a 'processing'
    const { error: updErr } = await supabase
      .from('imports')
      .update({ estado: 'processing' })
      .eq('id', importId);
    if (updErr) throw updErr;

    // 2. Obtener todas las filas de la importación paginadas (evitando el límite de 1000 de PostgREST)
    let rowsData: any[] = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;

    while (hasMore) {
      const fromRange = page * pageSize;
      const toRange = fromRange + pageSize - 1;

      const { data: chunkData, error: rowsErr } = await supabase
        .from('import_rows')
        .select('*')
        .eq('import_id', importId)
        .range(fromRange, toRange);

      if (rowsErr) throw rowsErr;

      if (!chunkData || chunkData.length === 0) {
        hasMore = false;
      } else {
        rowsData = rowsData.concat(chunkData);
        if (chunkData.length < pageSize) {
          hasMore = false;
        } else {
          page++;
        }
      }
    }

    const stagedRows = (rowsData || []).map(r => ({
      rowDbId: r.id,
      ...r.datos
    }));

    // 3. Traer todos los productos e inventarios actuales en un solo query para búsqueda rápida en memoria
    const { data: dbProducts, error: dbProdsErr } = await supabase
      .from('products')
      .select('*');
    if (dbProdsErr) throw dbProdsErr;

    const { data: dbInventory, error: dbInvErr } = await supabase
      .from('inventory')
      .select('product_id, stock')
      .eq('branch_id', branchId);
    if (dbInvErr) throw dbInvErr;

    // Indexar datos existentes en memoria
    const prodByIdMap = new Map<string, any>();
    const prodByCodeMap = new Map<string, any>();
    dbProducts?.forEach(p => {
      prodByIdMap.set(p.id, p);
      if (p.codigo) {
        prodByCodeMap.set(String(p.codigo).trim().toUpperCase(), p);
      }
    });

    const stockMap = new Map<string, number>();
    dbInventory?.forEach(inv => stockMap.set(inv.product_id, Number(inv.stock)));

    let createdCount = 0;
    let updatedCount = 0;
    let codeReplacedCount = 0;
    let failedCount = 0;
    const errorsList: any[] = [];

    // Arrays para acumulaciones bulk
    const productsUpsert: any[] = [];
    const pricesInsert: any[] = [];
    const inventoryUpsert: any[] = [];
    const movementsInsert: any[] = [];
    const codeHistoryInsert: any[] = [];
    const auditLogsInsert: any[] = [];
    
    const rowsCompletedIds: string[] = [];
    const rowsFailedUpdates: { id: string; error_detalle: string }[] = [];

    for (const sRow of stagedRows) {
      if (sRow.estado === 'ignored' || sRow.estado === 'error') {
        continue;
      }

      try {
        const rawCode = String(sRow.codigo || '').trim().toUpperCase();
        const rawDesc = String(sRow.descripcion || '').trim();
        const rawPrice = Number(sRow.precio) || 0;
        const rawStock = Number(sRow.stock) || 0;

        let targetProductId = sRow.matchedProductId;
        const oldCode = sRow.matchedProductCode ? String(sRow.matchedProductCode).trim() : undefined;

        const prodData: any = {
          codigo: rawCode,
          nombre: rawDesc,
          precio: rawPrice,
          activo: true,
          visible_en_app: true,
          unidad: 'unidad',
          presentacion: 'Presentación Importada',
          categoria: 'limpieza',
          destacado: false,
          dolarizado: false,
          precio_usd: 0.0,
          subcategoria: null,
          descripcion: null,
          imagen: null,
          precio_mayorista: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        if (sRow.marca) {
          prodData.marca = String(sRow.marca).trim();
        } else {
          prodData.marca = null;
        }

        const dbProdByCode = prodByCodeMap.get(rawCode);

        if (dbProdByCode) {
          targetProductId = dbProdByCode.id;
          const prevPrice = Number(dbProdByCode.precio || 0);
          
          const updates: any = { 
            id: targetProductId,
            codigo: rawCode || dbProdByCode.codigo,
            nombre: sRow.descripcion ? String(sRow.descripcion).trim() : dbProdByCode.nombre,
            precio: rawPrice,
            updated_at: new Date().toISOString()
          };
          if (sRow.marca) updates.marca = String(sRow.marca).trim();

          productsUpsert.push({
            ...dbProdByCode,
            ...updates
          });
          updatedCount++;

          if (prevPrice !== rawPrice) {
            pricesInsert.push({
              _code: rawCode,
              product_id: targetProductId,
              precio_anterior: prevPrice,
              precio_nuevo: rawPrice,
              cambio_tipo: 'masivo',
              usuario_responsable: userEmail,
              criterio: 'Importación diaria por código (auto-recuperado)'
            });
          }

        } else if (sRow.action === 'create_new') {
          prodData.codigo = rawCode;
          delete prodData.id;
          
          productsUpsert.push(prodData);
          createdCount++;

          pricesInsert.push({
            _code: rawCode,
            precio_anterior: 0,
            precio_nuevo: rawPrice,
            cambio_tipo: 'masivo',
            usuario_responsable: userEmail,
            criterio: 'Importación inicial de catálogo'
          });

        } else if (sRow.action === 'update_by_code' && targetProductId) {
          const dbProd = prodByIdMap.get(targetProductId);
          const prevPrice = dbProd ? Number(dbProd.precio) : 0;
          const assignedCode = rawCode || (dbProd ? dbProd.codigo : '') || (sRow.matchedProductCode ? String(sRow.matchedProductCode).trim() : '');
          
          const updates: any = { 
            codigo: assignedCode,
            nombre: sRow.descripcion ? String(sRow.descripcion).trim() : (dbProd ? dbProd.nombre : rawDesc),
            precio: rawPrice,
            updated_at: new Date().toISOString()
          };
          if (!isNaN(Number(targetProductId)) && !String(targetProductId).startsWith('prod-')) {
            updates.id = Number(targetProductId);
          }
          if (sRow.marca) updates.marca = String(sRow.marca).trim();

          const baseProd = dbProd || prodData;
          productsUpsert.push({
            ...baseProd,
            ...updates
          });
          updatedCount++;

          if (prevPrice !== rawPrice) {
            pricesInsert.push({
              _code: rawCode,
              precio_anterior: prevPrice,
              precio_nuevo: rawPrice,
              cambio_tipo: 'masivo',
              usuario_responsable: userEmail,
              criterio: 'Importación diaria por código'
            });
          }

        } else if (sRow.action === 'replace_code' && targetProductId) {
          const dbProd = prodByIdMap.get(targetProductId);
          const prevPrice = dbProd ? Number(dbProd.precio) : 0;
          const actualOldCode = oldCode || (dbProd ? dbProd.codigo : '');

          const updates: any = {
            codigo: rawCode || actualOldCode,
            nombre: sRow.descripcion ? String(sRow.descripcion).trim() : (dbProd ? dbProd.nombre : rawDesc),
            precio: rawPrice,
            updated_at: new Date().toISOString()
          };
          if (!isNaN(Number(targetProductId)) && !String(targetProductId).startsWith('prod-')) {
            updates.id = Number(targetProductId);
          }
          if (sRow.marca) updates.marca = String(sRow.marca).trim();

          const baseProd = dbProd || prodData;
          productsUpsert.push({
            ...baseProd,
            ...updates
          });
          codeReplacedCount++;

          if (actualOldCode && actualOldCode !== rawCode) {
            codeHistoryInsert.push({
              _code: rawCode,
              old_code: actualOldCode,
              new_code: rawCode,
              changed_by: userEmail,
              import_id: importId,
              reason: 'manufacturer_code_change',
              source: 'daily_excel_import'
            });
          }

          auditLogsInsert.push({
            usuario: userEmail,
            accion: 'UPDATE',
            entidad: 'products',
            registro_id: String(targetProductId),
            valores_anteriores: { codigo: oldCode, precio: prevPrice },
            valores_nuevos: { codigo: rawCode, precio: rawPrice },
            origen: 'frontend',
            observacion: `Reemplazo de código comercial por coincidencia única de descripción ("${sRow.descripcion}").`,
            referencia_relacionada: importId
          });

          if (prevPrice !== rawPrice) {
            pricesInsert.push({
              _code: rawCode,
              precio_anterior: prevPrice,
              precio_nuevo: rawPrice,
              cambio_tipo: 'masivo',
              usuario_responsable: userEmail,
              criterio: 'Importación diaria con cambio de código'
            });
          }
        }

        // Sincronización de Stock
        const isNew = sRow.action === 'create_new';
        const previousStock = isNew || !targetProductId ? 0 : Number(stockMap.get(String(targetProductId)) || 0);
        const difference = rawStock - previousStock;

        inventoryUpsert.push({
          _code: rawCode,
          product_id: targetProductId,
          branch_id: branchId,
          stock: rawStock,
          stock_minimo: 5,
          updated_at: new Date().toISOString()
        });

        if (isNew || difference !== 0) {
          movementsInsert.push({
            _code: rawCode,
            product_id: targetProductId,
            branch_id: branchId,
            cantidad_anterior: previousStock,
            cantidad_modificada: difference,
            cantidad_resultante: rawStock,
            tipo_movimiento: 'importacion',
            motivo: 'Sincronización diaria absoluta de stock',
            importacion_id: importId,
            usuario_responsable: userEmail
          });
        }

        rowsCompletedIds.push(sRow.rowDbId);
      } catch (err: any) {
        failedCount++;
        errorsList.push({ fila: sRow.filaNumero, error: err.message || String(err) });
        rowsFailedUpdates.push({ id: sRow.rowDbId, error_detalle: err.message || String(err) });
      }
    }

    // 4. Ejecución en Lotes Bulk en Supabase
    const chunkSize = 200;

    const uniqueByCode = new Map<string, any>();

    productsUpsert.forEach(p => {
      if (!p) return;
      const codeStr = String(p.codigo || '').trim().toUpperCase();
      if (!codeStr) return;

      const hasValidId = p.id && !isNaN(Number(p.id)) && !String(p.id).startsWith('prod-');

      const sanitized: any = {
        codigo: codeStr,
        nombre: String(p.nombre || 'Producto importado').trim(),
        precio: Number(p.precio) || 0,
        marca: p.marca ? String(p.marca).trim() : null,
        activo: p.activo ?? true,
        visible_en_app: p.visible_en_app ?? true,
        unidad: p.unidad || 'unidad',
        presentacion: p.presentacion || 'Presentación Importada',
        categoria: p.categoria || 'limpieza',
        destacado: p.destacado ?? false,
        dolarizado: p.dolarizado ?? false,
        precio_usd: Number(p.precio_usd) || 0,
        updated_at: new Date().toISOString()
      };

      if (hasValidId) {
        sanitized.id = Number(p.id);
      }

      uniqueByCode.set(codeStr, sanitized);
    });

    const finalProducts = Array.from(uniqueByCode.values());
    const newProductsToInsert = finalProducts.filter(p => !p.id);
    const existingProductsToUpdate = finalProducts.filter(p => p.id);

    const finalIdByCodeMap = new Map<string, number>();
    const validProductIds = new Set<number>();
    
    dbProducts?.forEach(p => {
      if (!isNaN(Number(p.id))) {
        validProductIds.add(Number(p.id));
        if (p.codigo) finalIdByCodeMap.set(String(p.codigo).trim().toUpperCase(), Number(p.id));
      }
    });

    // A1. Productos NUEVOS (Insert sin ID)
    if (newProductsToInsert.length > 0) {
      for (let i = 0; i < newProductsToInsert.length; i += chunkSize) {
        const chunk = newProductsToInsert.slice(i, i + chunkSize);
        let { data: inserted, error } = await supabase.from('products').insert(chunk).select('id, codigo');
        if (error && error.message?.includes('marca')) {
          const fallbackChunk = chunk.map(({ marca, ...rest }: any) => rest);
          const { data: retryInserted, error: retryErr } = await supabase.from('products').insert(fallbackChunk).select('id, codigo');
          if (retryErr) throw retryErr;
          inserted = retryInserted;
        } else if (error) {
          throw error;
        }
        inserted?.forEach((p: any) => {
          const numId = Number(p.id);
          validProductIds.add(numId);
          finalIdByCodeMap.set(String(p.codigo).trim().toUpperCase(), numId);
        });
      }
    }

    // A2. Productos EXISTENTES (Upsert con ID numérico)
    if (existingProductsToUpdate.length > 0) {
      for (let i = 0; i < existingProductsToUpdate.length; i += chunkSize) {
        const chunk = existingProductsToUpdate.slice(i, i + chunkSize);
        let { error } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });
        if (error && error.message?.includes('marca')) {
          const fallbackChunk = chunk.map(({ marca, ...rest }: any) => rest);
          const { error: retryErr } = await supabase.from('products').upsert(fallbackChunk, { onConflict: 'id' });
          if (retryErr) throw retryErr;
        } else if (error) {
          throw error;
        }
        chunk.forEach((p: any) => {
          const numId = Number(p.id);
          validProductIds.add(numId);
          finalIdByCodeMap.set(String(p.codigo).trim().toUpperCase(), numId);
        });
      }
    }

    // Mapa y conjunto de IDs válidos para evitar violaciones de clave foránea en tablas hijas
    const sanitizeChildItem = (item: any) => {
      const rawProdId = (item._code && finalIdByCodeMap.get(item._code)) || item.product_id;
      if (!rawProdId || isNaN(Number(rawProdId))) {
        return null;
      }
      const numProdId = Number(rawProdId);
      if (!validProductIds.has(numProdId)) {
        return null;
      }
      const { _code, ...cleanItem } = item;
      return {
        ...cleanItem,
        product_id: numProdId,
        branch_id: cleanItem.branch_id ? (isNaN(Number(cleanItem.branch_id)) ? branchId : Number(cleanItem.branch_id)) : undefined
      };
    };

    const cleanPricesInsert = pricesInsert.map(sanitizeChildItem).filter(Boolean);
    const cleanCodeHistoryInsert = codeHistoryInsert.map(sanitizeChildItem).filter(Boolean);
    const cleanMovementsInsert = movementsInsert.map(sanitizeChildItem).filter(Boolean);

    // B. Precios (Insert Historial - No bloqueante)
    if (cleanPricesInsert.length > 0) {
      try {
        for (let i = 0; i < cleanPricesInsert.length; i += chunkSize) {
          const chunk = cleanPricesInsert.slice(i, i + chunkSize);
          await supabase.from('product_prices').insert(chunk);
        }
      } catch (priceErr: any) {
        console.warn('Advertencia insertando historial de precios:', priceErr.message);
      }
    }

    // C. Historial de Códigos (Insert Historial - No bloqueante)
    if (cleanCodeHistoryInsert.length > 0) {
      try {
        for (let i = 0; i < cleanCodeHistoryInsert.length; i += chunkSize) {
          const chunk = cleanCodeHistoryInsert.slice(i, i + chunkSize);
          await supabase.from('product_code_history').insert(chunk);
        }
      } catch (codeErr: any) {
        console.warn('Advertencia insertando historial de códigos:', codeErr.message);
      }
    }

    // D. Logs de Auditoría (Insert Historial - No bloqueante)
    if (auditLogsInsert.length > 0) {
      try {
        for (let i = 0; i < auditLogsInsert.length; i += chunkSize) {
          const chunk = auditLogsInsert.slice(i, i + chunkSize);
          await supabase.from('audit_logs').insert(chunk);
        }
      } catch (auditErr: any) {
        console.warn('Advertencia insertando logs de auditoría:', auditErr.message);
      }
    }

    // E. Inventario / Stock Real (Upsert en la tabla inventory con fallback a stocks)
    const uniqueInventoryMap = new Map<string, any>();
    inventoryUpsert.forEach(inv => {
      const sanitizedInv = sanitizeChildItem(inv);
      if (!sanitizedInv) return;
      const key = `${sanitizedInv.product_id}_${sanitizedInv.branch_id}`;
      uniqueInventoryMap.set(key, sanitizedInv);
    });
    const finalInventoryUpsert = Array.from(uniqueInventoryMap.values());

    for (let i = 0; i < finalInventoryUpsert.length; i += chunkSize) {
      const chunk = finalInventoryUpsert.slice(i, i + chunkSize);
      const { error: invErr } = await supabase.from('inventory').upsert(chunk, { onConflict: 'product_id,branch_id' });
      if (invErr) {
        console.warn('Error en upsert inventory, reintentando en stocks:', invErr.message);
        const stocksChunk = chunk.map(c => ({
          product_id: c.product_id,
          branch_id: c.branch_id,
          stock: c.stock,
          stock_minimo: c.stock_minimo || 5,
          updated_at: c.updated_at
        }));
        await supabase.from('stocks').upsert(stocksChunk, { onConflict: 'product_id,branch_id' });
      }
    }

    // F. Movimientos de Stock (Insert Historial - No bloqueante)
    if (cleanMovementsInsert.length > 0) {
      try {
        for (let i = 0; i < cleanMovementsInsert.length; i += chunkSize) {
          const chunk = cleanMovementsInsert.slice(i, i + chunkSize);
          await supabase.from('inventory_movements').insert(chunk);
        }
      } catch (movErr: any) {
        console.warn('Advertencia insertando movimientos de stock:', movErr.message);
      }
    }

    // G. Actualizar filas de importación exitosas en Supabase
    try {
      for (let i = 0; i < rowsCompletedIds.length; i += chunkSize) {
        const chunk = rowsCompletedIds.slice(i, i + chunkSize);
        await supabase
          .from('import_rows')
          .update({ estado: 'exitoso' })
          .in('id', chunk);
      }
    } catch (rowsErr: any) {
      console.warn('Advertencia actualizando import_rows:', rowsErr.message);
    }

    // H. Actualizar filas fallidas en Supabase
    try {
      for (const fail of rowsFailedUpdates) {
        await supabase
          .from('import_rows')
          .update({ estado: 'error', error_detalle: fail.error_detalle })
          .eq('id', fail.id);
      }
    } catch (failErr: any) {
      console.warn('Advertencia actualizando import_rows fallidas:', failErr.message);
    }

    // 5. Actualizar resumen final de la importación
    const finalState = 'completado';
    const { data: finalImp, error: finalImpErr } = await supabase
      .from('imports')
      .update({
        estado: finalState,
        productos_creados: createdCount,
        productos_actualizados: updatedCount + codeReplacedCount,
        filas_rechazadas: failedCount,
        errores: errorsList.length > 0 ? errorsList : null
      })
      .eq('id', importId)
      .select('*')
      .single();

    if (finalImpErr) throw finalImpErr;
    return finalImp;
  },

  createSuperOffer: async (offer: any, items: any[]): Promise<any> => {
    const insertPayload: any = {
      nombre: offer.nombre,
      descripcion: offer.descripcion || null,
      precio_oferta: offer.precioOferta ?? offer.precio_oferta,
      precio_original: offer.precioOriginal ?? offer.precio_original,
      activo: offer.activo ?? true
    };
    if (offer.fechaFin || offer.fecha_fin) {
      insertPayload.fecha_fin = offer.fechaFin ? new Date(offer.fechaFin).toISOString() : new Date(offer.fecha_fin).toISOString();
    }

    const { data: createdOffer, error: offerErr } = await supabase
      .from('super_offers')
      .insert(insertPayload)
      .select('*')
      .single();

    if (offerErr) {
      if (insertPayload.fecha_fin) {
        delete insertPayload.fecha_fin;
        const { data: fallbackOffer, error: fallbackErr } = await supabase
          .from('super_offers')
          .insert(insertPayload)
          .select('*')
          .single();
        if (fallbackErr) throw fallbackErr;
        return productService.insertSuperOfferItems(fallbackOffer, items);
      }
      throw offerErr;
    }

    return productService.insertSuperOfferItems(createdOffer, items);
  },

  insertSuperOfferItems: async (createdOffer: any, items: any[]): Promise<any> => {
    const offerItemsToInsert = items.map(item => {
      const pId = item.productId || item.product_id;
      return {
        offer_id: createdOffer.id,
        product_id: typeof pId === 'number' ? pId : (isNaN(Number(pId)) ? pId : Number(pId)),
        cantidad: item.cantidad,
        unidad: item.unidad || 'U'
      };
    });

    const { error: itemsErr } = await supabase
      .from('super_offer_items')
      .insert(offerItemsToInsert);
    if (itemsErr) throw itemsErr;

    return createdOffer;
  },

  getSuperOffers: async (isPublic?: boolean): Promise<any[]> => {
    const { data, error } = await supabase
      .from('super_offers')
      .select(isPublic ? `
        id, nombre, descripcion, activo, created_at,
        super_offer_items (
          id, offer_id, product_id, cantidad, unidad,
          products:products (
            id, codigo, nombre, categoria, subcategoria, presentacion, unidad, descripcion, imagen, activo, visible_en_app, destacado
          )
        )
      ` : `
        *,
        super_offer_items (
          id, offer_id, product_id, cantidad, unidad,
          products:products (*)
        )
      `)
      .order('created_at', { ascending: false });
    if (error) throw error;

    let list = data || [];
    if (isPublic) {
      list = list.filter((offer: any) => offer.activo && !offer.deleted_at);
      return list.map((offer: any) => ({
        ...offer,
        precio_oferta: 0,
        precio_original: 0,
        super_offer_items: (offer.super_offer_items || []).map((item: any) => ({
          ...item,
          products: item.products ? mapProduct(item.products, 1000, true) : null
        }))
      }));
    }
    return list;
  },

  deleteSuperOffer: async (id: string): Promise<void> => {
    const nowStr = new Date().toISOString();
    const { error } = await supabase
      .from('super_offers')
      .update({
        activo: false,
        deleted_at: nowStr
      })
      .eq('id', id);

    if (error) {
      const { error: fallbackErr } = await supabase
        .from('super_offers')
        .update({
          activo: false
        })
        .eq('id', id);
      if (fallbackErr) throw fallbackErr;
    }
  }
};
