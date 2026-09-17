import { supabase } from './supabaseClient';
import { processLogService } from './processLogService';
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
    updatedByUserId: d.updated_by_user_id || undefined,
    updatedByRoleId: d.updated_by_role_id || undefined,
    updatedByBranchId: d.updated_by_branch_id || undefined,
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
  photoFilter?: 'all' | 'with-photo' | 'no-photo';
  activeStatusFilter?: 'all' | 'active' | 'inactive';
  stockFilter?: 'all' | 'with-stock' | 'critico' | 'no-stock';
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
    const isPublic = !!options.isPublic;

    const rate = await productService.getLatestExchangeRate();

    const sortAsc = options.sortOrder !== 'desc';
    const isStockFilterActive = options.stockFilter && options.stockFilter !== 'all';

    const selectCols = isPublic
      ? 'id, codigo, nombre, categoria, subcategoria, presentacion, unidad, descripcion, imagen, activo, visible_en_app, destacado, created_at, updated_at'
      : '*';

    let query = supabase
      .from('products')
      .select(selectCols, { count: 'exact' });

    // 1. Filtro por Estado Activo / Inactivo
    if (isPublic || options.activeStatusFilter === 'active') {
      query = query.eq('activo', true);
    } else if (options.activeStatusFilter === 'inactive') {
      query = query.or('activo.is.null,activo.eq.false');
    }

    // 2. Filtro por Foto (Con Foto / Sin Foto)
    if (options.photoFilter === 'no-photo') {
      query = query.or('imagen.is.null,imagen.eq.');
    } else if (options.photoFilter === 'with-photo') {
      query = query.not('imagen', 'is', null).neq('imagen', '');
    }

    // 3. Filtro por Categoría
    if (options.categoria && options.categoria !== 'todos' && options.categoria !== 'all') {
      query = query.eq('categoria', options.categoria);
    }

    // 4. Búsqueda por texto (nombre, código, descripción, presentación)
    if (options.search && options.search.trim()) {
      const q = options.search.trim();
      query = query.or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%,descripcion.ilike.%${q}%,presentacion.ilike.%${q}%`);
    }

    // Si NO hay filtro de stock en memoria, aplicar ordenamiento y paginación directamente en PostgREST (Supabase)
    if (!isStockFilterActive) {
      if (options.sortBy === 'price' || options.sortBy === 'precio-bajo') {
        query = query.order('precio', { ascending: true });
      } else if (options.sortBy === 'precio-alto') {
        query = query.order('precio', { ascending: false });
      } else if (options.sortBy === 'code') {
        query = query.order('codigo', { ascending: sortAsc });
      } else if (options.sortBy === 'category') {
        query = query.order('categoria', { ascending: sortAsc }).order('nombre', { ascending: true });
      } else if (options.sortBy === 'name') {
        query = query.order('nombre', { ascending: sortAsc });
      } else {
        query = query.order('destacado', { ascending: false }).order('nombre', { ascending: true });
      }

      const fromIndex = (page - 1) * pageSize;
      const toIndex = fromIndex + pageSize - 1;
      query = query.range(fromIndex, toIndex);
    } else {
      // Si hay filtro especial de stock en admin, obtenemos todos los registros para evaluar stock en memoria
      query = query.range(0, 99999);
    }

    const { data: rawProducts, count: exactTotalCount, error } = await query;
    if (error) {
      console.error('Error cargando productos en getPaginated:', error.message);
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const allMatchedProducts = rawProducts || [];
    const prodIds = allMatchedProducts.map((p: any) => p.id);

    // Cargar información de inventario/stock para los productos encontrados
    const stocksMap = new Map<string, { stock: number; stockMinimo: number }>();
    if (prodIds.length > 0) {
      try {
        let invQuery = supabase.from('inventory').select('product_id, branch_id, stock, stock_minimo').in('product_id', prodIds);
        if (options.branchId && options.branchId !== 'all') {
          const bId = Number(options.branchId);
          if (!isNaN(bId)) invQuery = invQuery.eq('branch_id', bId);
        }
        const { data: invData, error: invErr } = await invQuery;
        if (!invErr && invData) {
          invData.forEach((s: any) => {
            const pid = String(s.product_id);
            const prev = stocksMap.get(pid) || { stock: 0, stockMinimo: Number(s.stock_minimo) || 5 };
            stocksMap.set(pid, {
              stock: prev.stock + Number(s.stock || 0),
              stockMinimo: Number(s.stock_minimo) || 5
            });
          });
        } else if (invErr) {
          // Fallback a la tabla stocks SOLO si la consulta a inventory falló con un error de BD
          let stQuery = supabase.from('stocks').select('product_id, branch_id, stock, stock_minimo').in('product_id', prodIds);
          if (options.branchId && options.branchId !== 'all') {
            const bId = Number(options.branchId);
            if (!isNaN(bId)) stQuery = stQuery.eq('branch_id', bId);
          }
          const { data: stData } = await stQuery;
          if (stData) {
            stData.forEach((s: any) => {
              const pid = String(s.product_id);
              const prev = stocksMap.get(pid) || { stock: 0, stockMinimo: Number(s.stock_minimo) || 5 };
              stocksMap.set(pid, {
                stock: prev.stock + Number(s.stock || 0),
                stockMinimo: Number(s.stock_minimo) || 5
              });
            });
          }
        }
      } catch (_) {}
    }

    let processed = allMatchedProducts.map((p: any) => {
      const stInfo = stocksMap.get(String(p.id)) || { stock: 0, stockMinimo: 5 };
      return {
        ...mapProduct(p, rate, isPublic),
        stock: stInfo.stock,
        stockMinimo: stInfo.stockMinimo
      };
    });

    // 5. Filtro por Nivel de Stock (Solo en admin panel si se solicitó)
    if (isStockFilterActive) {
      if (options.stockFilter === 'with-stock') {
        processed = processed.filter(p => p.stock > 0);
      } else if (options.stockFilter === 'critico') {
        processed = processed.filter(p => p.stock <= p.stockMinimo);
      } else if (options.stockFilter === 'no-stock') {
        processed = processed.filter(p => p.stock <= 0);
      }

      processed.sort((a, b) => {
        if (options.sortBy === 'stock') {
          return sortAsc ? a.stock - b.stock : b.stock - a.stock;
        } else if (options.sortBy === 'price' || options.sortBy === 'precio-bajo') {
          return sortAsc ? a.precio - b.precio : b.precio - a.precio;
        } else if (options.sortBy === 'precio-alto') {
          return b.precio - a.precio;
        } else if (options.sortBy === 'code') {
          return sortAsc ? (a.codigo || '').localeCompare(b.codigo || '') : (b.codigo || '').localeCompare(a.codigo || '');
        } else if (options.sortBy === 'category') {
          return sortAsc ? (a.categoria || '').localeCompare(b.categoria || '') : (b.categoria || '').localeCompare(a.categoria || '');
        } else if (options.sortBy === 'name') {
          return sortAsc ? (a.nombre || '').localeCompare(b.nombre || '') : (b.nombre || '').localeCompare(a.nombre || '');
        } else {
          if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
          return (a.nombre || '').localeCompare(b.nombre || '');
        }
      });

      const total = processed.length;
      const totalPages = Math.ceil(total / pageSize) || 1;
      const fromIndex = (page - 1) * pageSize;
      const pageData = processed.slice(fromIndex, fromIndex + pageSize);

      return {
        data: pageData,
        total,
        page,
        pageSize,
        totalPages
      };
    }

    // Paginación directa con conteo exacto de Supabase para más de 6000 productos
    const total = exactTotalCount ?? processed.length;
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data: processed,
      total,
      page,
      pageSize,
      totalPages
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

    const targetBranch = branchId && branchId !== 'all' ? branchId : undefined;

    // 2. Obtener todo el inventario paginado para la sucursal (evitando límite de 1000)
    let stocks: any[] = [];
    let hasMoreStocks = true;
    let stockPage = 0;

    while (hasMoreStocks) {
      const fromRange = stockPage * pageSize;
      const toRange = fromRange + pageSize - 1;

      let invQuery = supabase
        .from('inventory')
        .select('product_id, branch_id, stock, stock_minimo');

      if (targetBranch) {
        invQuery = invQuery.eq('branch_id', Number(targetBranch));
      }

      const { data: chunk, error: stockErr } = await invQuery.range(fromRange, toRange);

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

    const stocksMap = new Map<string, { stock: number; stockMinimo: number }>();
    (stocks || []).forEach((s: any) => {
      const pid = String(s.product_id);
      const prev = stocksMap.get(pid) || { stock: 0, stockMinimo: Number(s.stock_minimo) || 5 };
      stocksMap.set(pid, {
        stock: prev.stock + Number(s.stock || 0),
        stockMinimo: Number(s.stock_minimo) || 5
      });
    });

    return (prods || []).map((p: any) => {
      const stockInfo = stocksMap.get(String(p.id)) || { stock: 0, stockMinimo: 5 };
      return {
        ...mapProduct(p, rate, isPublic),
        stock: stockInfo.stock,
        stockMinimo: stockInfo.stockMinimo,
      };
    });
  },

  getProductStocksAllBranches: async (productId: string): Promise<Record<string, { stock: number; stockMinimo: number }>> => {
    try {
      const { data: invData, error: invErr } = await supabase
        .from('inventory')
        .select('branch_id, stock, stock_minimo')
        .eq('product_id', productId);

      const result: Record<string, { stock: number; stockMinimo: number }> = {};
      if (!invErr && invData) {
        invData.forEach((s: any) => {
          result[String(s.branch_id)] = {
            stock: Number(s.stock || 0),
            stockMinimo: Number(s.stock_minimo || 5)
          };
        });
      } else if (invErr) {
        const { data: stData } = await supabase
          .from('stocks')
          .select('branch_id, stock, stock_minimo')
          .eq('product_id', productId);
        if (stData) {
          stData.forEach((s: any) => {
            result[String(s.branch_id)] = {
              stock: Number(s.stock || 0),
              stockMinimo: Number(s.stock_minimo || 5)
            };
          });
        }
      }
      return result;
    } catch (_) {
      return {};
    }
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
      updated_by_user_id: updates.updatedByUserId,
      updated_by_role_id: updates.updatedByRoleId,
      updated_by_branch_id: updates.updatedByBranchId ? Number(updates.updatedByBranchId) : undefined,
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
    // Auto-marcar como error las importaciones colgadas de más de 10 minutos
    try {
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      await supabase
        .from('imports')
        .update({ estado: 'error', errores: { message: 'Proceso interrumpido o colgado antes de finalizar.' } })
        .in('estado', ['processing', 'procesando', 'uploaded', 'pending'])
        .lt('fecha', tenMinsAgo);
    } catch (_) {}

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
    try {
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

      // 1. Cambiar estado a 'processing' y registrar en processLogService
      const procLogId = await processLogService.startProcess('Importación Excel de Catálogo', branchId, userEmail, { import_id: importId });

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

      // 3. Traer todos los productos e inventarios actuales con paginación completa para evitar límite de 1000
      let dbProducts: any[] = [];
      let hasMoreProds = true;
      let prodPage = 0;
      const prodPageSize = 1000;

      while (hasMoreProds) {
        const fromRange = prodPage * prodPageSize;
        const toRange = fromRange + prodPageSize - 1;

        const { data: chunk, error: prodErr } = await supabase
          .from('products')
          .select('*')
          .is('deleted_at', null)
          .range(fromRange, toRange);

        if (prodErr) throw prodErr;

        if (!chunk || chunk.length === 0) {
          hasMoreProds = false;
        } else {
          dbProducts = dbProducts.concat(chunk);
          if (chunk.length < prodPageSize) {
            hasMoreProds = false;
          } else {
            prodPage++;
          }
        }
      }

      let dbInventory: any[] = [];
      let hasMoreInv = true;
      let invPage = 0;
      const invPageSize = 1000;

      while (hasMoreInv) {
        const fromRange = invPage * invPageSize;
        const toRange = fromRange + invPageSize - 1;

        const { data: chunk, error: invErr } = await supabase
          .from('inventory')
          .select('product_id, stock')
          .eq('branch_id', branchId)
          .range(fromRange, toRange);

        if (invErr) throw invErr;

        if (!chunk || chunk.length === 0) {
          hasMoreInv = false;
        } else {
          dbInventory = dbInventory.concat(chunk);
          if (chunk.length < invPageSize) {
            hasMoreInv = false;
          } else {
            invPage++;
          }
        }
      }

      // Indexar datos existentes en memoria de forma ultra robusta
      const prodByIdMap = new Map<string, any>();
      const prodByCodeMap = new Map<string, any>();
      const prodByNameMap = new Map<string, any>();

      const cleanCodeStr = (c: any) => {
        if (!c) return '';
        let s = String(c).trim().toUpperCase();
        if (s.endsWith('.0')) s = s.slice(0, -2);
        return s.replace(/[^A-Z0-9]/g, '');
      };

      const cleanNameStr = (n: any) => {
        if (!n) return '';
        return String(n).toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
      };

      dbProducts?.forEach(p => {
        prodByIdMap.set(String(p.id), p);
        if (p.codigo) {
          const rawC = String(p.codigo).trim().toUpperCase();
          const normC = cleanCodeStr(p.codigo);
          prodByCodeMap.set(rawC, p);
          if (normC) prodByCodeMap.set(normC, p);
        }
        if (p.nombre) {
          const normN = cleanNameStr(p.nombre);
          if (normN) prodByNameMap.set(normN, p);
        }
      });

      const stockMap = new Map<string, number>();
      dbInventory?.forEach(inv => stockMap.set(String(inv.product_id), Number(inv.stock)));

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
            branch_id: branchId,
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

          const normCode = cleanCodeStr(rawCode);
          const normDesc = cleanNameStr(rawDesc);
          const dbProdByCode = prodByCodeMap.get(rawCode) || (normCode ? prodByCodeMap.get(normCode) : null) || (normDesc ? prodByNameMap.get(normDesc) : null);

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
          branch_id: p.branch_id ? Number(p.branch_id) : branchId,
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
      await processLogService.finishProcess(procLogId, 'completado', {
        productos_creados: createdCount,
        productos_actualizados: updatedCount + codeReplacedCount,
        filas_rechazadas: failedCount
      });
      return finalImp;
    } catch (err: any) {
      console.error('Error fatal durante confirmImport:', err);
      try {
        await supabase
          .from('imports')
          .update({
            estado: 'error',
            errores: { message: err.message || String(err) }
          })
          .eq('id', importId);
      } catch (_) {}
      throw err;
    }
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
  },

  getMatchingProductsForPriceUpdate: async (options: Partial<BulkPriceUpdateOptions>): Promise<any[]> => {
    let query = supabase
      .from('products')
      .select('id, codigo, nombre, categoria, marca, precio, precio_mayorista')
      .is('deleted_at', null)
      .eq('activo', true);

    const category = options.categoria || options.category;
    const marca = options.marca || options.brand;
    const codigoDesde = options.codigoDesde || options.codeFrom;
    const codigoHasta = options.codigoHasta || options.codeTo;

    if (category && category !== 'todos' && category !== 'all') {
      query = query.eq('categoria', category);
    }
    if (marca && marca !== 'todas' && marca !== 'all') {
      query = query.eq('marca', marca);
    }
    if (codigoDesde && codigoDesde.trim()) {
      query = query.gte('codigo', codigoDesde.trim().toUpperCase());
    }
    if (codigoHasta && codigoHasta.trim()) {
      query = query.lte('codigo', codigoHasta.trim().toUpperCase());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  getDistinctBrands: async (): Promise<string[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('marca')
      .not('marca', 'is', null)
      .neq('marca', '');
    if (error) return [];
    const brands = Array.from(new Set((data || []).map((p: any) => p.marca).filter(Boolean)));
    return (brands as string[]).sort();
  },

  bulkUpdatePrices: async (options: BulkPriceUpdateOptions): Promise<{ updatedCount: number }> => {
    const matchingProducts = await productService.getMatchingProductsForPriceUpdate(options);
    if (matchingProducts.length === 0) {
      return { updatedCount: 0 };
    }

    const nowIso = new Date().toISOString();
    const userEmail = options.auditInfo?.userEmail || options.userEmail || 'admin@quimicadeheza.com';
    const userId = options.auditInfo?.userId || 'admin';
    const roleId = options.auditInfo?.roleId || 'admin';
    const branchId = options.auditInfo?.branchId ? Number(options.auditInfo.branchId) : (options.branchId && options.branchId !== 'all' ? Number(options.branchId) : 1);

    const applyRounding = (val: number, rule: any): number => {
      if (val < 0) val = 0;
      const numRule = typeof rule === 'number' ? rule : parseFloat(String(rule));
      if (numRule === 1) return Math.round(val);
      if (numRule === 0.1) return Math.round(val * 10) / 10;
      if (numRule === 5) return Math.round(val / 5) * 5;
      if (numRule === 10) return Math.round(val / 10) * 10;
      if (numRule === 100) return Math.round(val / 100) * 100;
      if (rule === '1.00') return Math.round(val);
      if (rule === '0.10') return Math.round(val * 10) / 10;
      if (rule === '5.00') return Math.round(val / 5) * 5;
      if (rule === '10.00') return Math.round(val / 10) * 10;
      if (rule === '100.00') return Math.round(val / 100) * 100;
      return Math.round(val * 100) / 100;
    };

    const targetList = options.listaAfectada || options.targetList || 'precio_venta';
    const baseList = options.listaBase || options.baseList || 'misma_lista';
    const modoCalculo = options.modoCalculo || options.adjustmentMode || 'porcentaje';
    const valor = options.valor ?? options.value ?? 0;
    const redondeo = options.redondeo ?? options.rounding ?? 'sin_redondeo';
    const categoria = options.categoria || options.category;
    const marca = options.marca || options.brand;

    const targetCol = targetList === 'precio_mayorista' ? 'precio_mayorista' : 'precio';
    const baseCol = baseList === 'precio_mayorista' ? 'precio_mayorista' : 'precio';

    const updatesBatch: any[] = [];
    const priceLogsBatch: any[] = [];

    const criterioText = [
      categoria && categoria !== 'todos' && categoria !== 'all' ? `Rubro: ${categoria}` : null,
      marca && marca !== 'todas' && marca !== 'all' ? `Marca: ${marca}` : null,
      `Ajuste: ${valor > 0 ? '+' : ''}${valor}${modoCalculo === 'porcentaje' ? '%' : '$'}`,
      `Redondeo: ${redondeo}`
    ].filter(Boolean).join(' | ');

    for (const p of matchingProducts) {
      const currentPrice = Number(p[baseCol] || p.precio || 0);
      let calculatedPrice = currentPrice;

      if (modoCalculo === 'porcentaje') {
        calculatedPrice = currentPrice * (1 + (valor / 100));
      } else {
        calculatedPrice = currentPrice + valor;
      }

      const newPrice = applyRounding(calculatedPrice, redondeo);

      updatesBatch.push({
        id: p.id,
        [targetCol]: newPrice,
        updated_at: nowIso,
        updated_by_user_id: userId,
        updated_by_role_id: roleId,
        updated_by_branch_id: branchId,
      });

      priceLogsBatch.push({
        product_id: p.id,
        precio_anterior: currentPrice,
        precio_nuevo: newPrice,
        cambio_tipo: 'masivo',
        criterio: criterioText,
        usuario_responsable: userEmail,
        created_at: nowIso,
      });
    }

    const chunkSize = 50;
    for (let i = 0; i < updatesBatch.length; i += chunkSize) {
      const chunk = updatesBatch.slice(i, i + chunkSize);
      const logChunk = priceLogsBatch.slice(i, i + chunkSize);

      for (const item of chunk) {
        await supabase
          .from('products')
          .update({
            [targetCol]: item[targetCol],
            updated_at: item.updated_at,
            updated_by_user_id: item.updated_by_user_id,
            updated_by_role_id: item.updated_by_role_id,
            updated_by_branch_id: item.updated_by_branch_id,
          })
          .eq('id', item.id);
      }

      try {
        await supabase.from('product_prices').insert(logChunk);
      } catch (logErr) {
        console.warn('Error guardando en product_prices:', logErr);
      }
    }

    try {
      await supabase.from('process_executions').insert({
        nombre_proceso: 'Actualización Masiva de Precios',
        branch_id: branchId,
        usuario: userEmail,
        estado: 'completado',
        detalles: {
          productos_actualizados: updatesBatch.length,
          criterio: criterioText,
          lista_afectada: targetCol,
          modo: modoCalculo,
          valor: valor,
        },
        fecha_inicio: nowIso,
        fecha_fin: new Date().toISOString(),
      });
    } catch (_) {}

    return { updatedCount: updatesBatch.length };
  }
};

export interface BulkPriceUpdateOptions {
  marca?: string;
  brand?: string;
  categoria?: string;
  category?: string;
  proveedor?: string;
  supplier?: string;
  codigoDesde?: string;
  codeFrom?: string;
  codigoHasta?: string;
  codeTo?: string;
  variacionTipo?: 'costo' | 'precio_venta';
  variationType?: 'costo' | 'precio_venta';
  listaAfectada?: 'precio' | 'precio_venta' | 'precio_mayorista';
  targetList?: 'precio' | 'precio_venta' | 'precio_mayorista';
  listaBase?: 'misma_lista' | 'precio' | 'precio_venta' | 'precio_mayorista';
  baseList?: 'misma_lista' | 'precio' | 'precio_venta' | 'precio_mayorista';
  modoCalculo?: 'porcentaje' | 'monto';
  adjustmentMode?: 'porcentaje' | 'monto';
  valor?: number;
  value?: number;
  redondeo?: 'sin_redondeo' | '1.00' | '0.10' | '5.00' | '10.00' | '100.00' | number;
  rounding?: 'sin_redondeo' | '1.00' | '0.10' | '5.00' | '10.00' | '100.00' | number;
  branchId?: string | number;
  userEmail?: string;
  auditInfo?: {
    userId?: string;
    roleId?: string;
    branchId?: string | number;
    userEmail?: string;
  };
}
