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

      if (prodErr) throw prodErr;

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

    const targetBranch = branchId && branchId !== 'all' ? branchId : 'branch-gd1';

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
      const stockInfo = (stocks || []).find((s: any) => s.product_id === p.id);
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

    const targetBranch = branchId && branchId !== 'all' ? branchId : 'branch-gd1';
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
    const productId = `prod-${Date.now()}`;
    
    // Normalizar código
    const normalizedCode = product.codigo.trim().toUpperCase();

    const dbInsert = {
      id: productId,
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

    // Crear movimientos de stock iniciales
    const branchesToInit = ['branch-gd1', 'branch-gd2', 'branch-rc', 'branch-gig'];
    for (const bId of branchesToInit) {
      const qty = initialStockPerBranch[bId] ?? 0;
      // Inserción en inventory_movements actualizará la tabla inventory por trigger
      const { error: stockErr } = await supabase
        .from('inventory_movements')
        .insert({
          product_id: productId,
          branch_id: bId,
          cantidad_modificada: qty,
          tipo_movimiento: 'carga_inicial',
          motivo: 'Carga inicial en creación de producto',
          usuario_responsable: userMail || ''
        });
      if (stockErr) {
        console.error(`Failed to seed stock for branch ${bId} on product ${productId}:`, stockErr);
      }
    }

    return mapProduct(data, rate);
  },

  update: async (id: string, updates: Partial<Product> & { dolarizado?: boolean; precio_usd?: number }): Promise<Product> => {
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

  createStagingImport: async (fileName: string, userEmail: string, fileHash: string, stagedRowsCount: number): Promise<any> => {
    const { data, error } = await supabase
      .from('imports')
      .insert({
        nombre_archivo: fileName,
        usuario: userEmail,
        cantidad_filas: stagedRowsCount,
        file_hash: fileHash,
        estado: 'uploaded'
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  insertStagingRows: async (importId: string, rows: any[]): Promise<void> => {
    const records = rows.map(r => ({
      import_id: importId,
      fila_numero: r.filaNumero,
      datos: r,
      estado: r.estado,
      error_detalle: r.validationErrors ? r.validationErrors.join(', ') : null
    }));

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

  confirmImport: async (importId: string, branchId: string, userEmail: string): Promise<any> => {
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
          targetProductId = `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          prodData.id = targetProductId;
          prodData.codigo = rawCode;
          
          productsUpsert.push(prodData);
          createdCount++;

          pricesInsert.push({
            _code: rawCode,
            product_id: targetProductId,
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
            id: targetProductId,
            codigo: assignedCode,
            nombre: sRow.descripcion ? String(sRow.descripcion).trim() : (dbProd ? dbProd.nombre : rawDesc),
            precio: rawPrice,
            updated_at: new Date().toISOString()
          };
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
              product_id: targetProductId,
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
            id: targetProductId,
            codigo: rawCode || actualOldCode,
            nombre: sRow.descripcion ? String(sRow.descripcion).trim() : (dbProd ? dbProd.nombre : rawDesc),
            precio: rawPrice,
            updated_at: new Date().toISOString()
          };
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
              product_id: targetProductId,
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
            registro_id: targetProductId,
            valores_anteriores: { codigo: oldCode, precio: prevPrice },
            valores_nuevos: { codigo: rawCode, precio: rawPrice },
            origen: 'frontend',
            observacion: `Reemplazo de código comercial por coincidencia única de descripción ("${sRow.descripcion}").`,
            referencia_relacionada: importId
          });

          if (prevPrice !== rawPrice) {
            pricesInsert.push({
              _code: rawCode,
              product_id: targetProductId,
              precio_anterior: prevPrice,
              precio_nuevo: rawPrice,
              cambio_tipo: 'masivo',
              usuario_responsable: userEmail,
              criterio: 'Importación diaria con cambio de código'
            });
          }
        }

        // Sincronización de Stock
        if (targetProductId) {
          const isNew = sRow.action === 'create_new';
          const previousStock = isNew ? 0 : Number(stockMap.get(targetProductId) || 0);
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
        }

        rowsCompletedIds.push(sRow.rowDbId);
      } catch (err: any) {
        failedCount++;
        errorsList.push({ fila: sRow.filaNumero, error: err.message || String(err) });
        rowsFailedUpdates.push({ id: sRow.rowDbId, error_detalle: err.message || String(err) });
      }
    }

    // 4. Ejecución en Lotes Bulk en Supabase (Chunked para no saturar el servidor)
    const chunkSize = 200;

    // Filtro de seguridad para evitar duplicados del mismo código comercial en el lote de upsert
    // Desduplicación estricta en memoria tanto por ID como por CÓDIGO para evitar colisiones en PostgreSQL
    const uniqueById = new Map<string, any>();
    const uniqueByCode = new Map<string, any>();

    productsUpsert.forEach(p => {
      if (!p) return;
      const idStr = String(p.id || '').trim();
      const codeStr = String(p.codigo || '').trim().toUpperCase();
      if (!idStr || !codeStr) return;

      const sanitized = {
        id: idStr,
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

      // Si el código ya existía con otro ID diferente, eliminar el anterior de uniqueById
      if (uniqueByCode.has(codeStr)) {
        const prev = uniqueByCode.get(codeStr);
        if (prev && prev.id !== idStr) {
          uniqueById.delete(prev.id);
        }
      }

      // Si el ID ya existía con otro código diferente, eliminar el anterior de uniqueByCode
      if (uniqueById.has(idStr)) {
        const prev = uniqueById.get(idStr);
        if (prev && prev.codigo !== codeStr) {
          uniqueByCode.delete(prev.codigo);
        }
      }

      uniqueById.set(idStr, sanitized);
      uniqueByCode.set(codeStr, sanitized);
    });

    const finalProductsUpsert = Array.from(uniqueById.values());

    // A. Productos (Upsert con onConflict: 'id')
    for (let i = 0; i < finalProductsUpsert.length; i += chunkSize) {
      const chunk = finalProductsUpsert.slice(i, i + chunkSize);
      const { error } = await supabase.from('products').upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
    }

    // Mapa y conjunto de IDs válidos para evitar violaciones de clave foránea en tablas hijas
    const finalIdByCodeMap = new Map<string, string>();
    const validProductIds = new Set<string>();
    
    dbProducts?.forEach(p => validProductIds.add(p.id));
    finalProductsUpsert.forEach(p => {
      validProductIds.add(p.id);
      finalIdByCodeMap.set(p.codigo, p.id);
    });

    const sanitizeChildItem = (item: any) => {
      const resolvedId = (item._code && finalIdByCodeMap.get(item._code)) || item.product_id;
      if (!resolvedId || !validProductIds.has(resolvedId)) {
        return null;
      }
      const { _code, ...cleanItem } = item;
      return {
        ...cleanItem,
        product_id: resolvedId
      };
    };

    const cleanPricesInsert = pricesInsert.map(sanitizeChildItem).filter(Boolean);
    const cleanCodeHistoryInsert = codeHistoryInsert.map(sanitizeChildItem).filter(Boolean);
    const cleanMovementsInsert = movementsInsert.map(sanitizeChildItem).filter(Boolean);

    // B. Precios (Insert)
    for (let i = 0; i < cleanPricesInsert.length; i += chunkSize) {
      const chunk = cleanPricesInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from('product_prices').insert(chunk);
      if (error) throw error;
    }

    // C. Historial de Códigos (Insert)
    for (let i = 0; i < cleanCodeHistoryInsert.length; i += chunkSize) {
      const chunk = cleanCodeHistoryInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from('product_code_history').insert(chunk);
      if (error) throw error;
    }

    // D. Logs de Auditoría (Insert)
    for (let i = 0; i < auditLogsInsert.length; i += chunkSize) {
      const chunk = auditLogsInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from('audit_logs').insert(chunk);
      if (error) throw error;
    }

    // E. Inventario / Stock Real (Upsert en la tabla inventory)
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
      const { error } = await supabase.from('inventory').upsert(chunk, { onConflict: 'product_id,branch_id' });
      if (error) throw error;
    }

    // F. Movimientos de Stock (Insert)
    for (let i = 0; i < cleanMovementsInsert.length; i += chunkSize) {
      const chunk = cleanMovementsInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from('inventory_movements').insert(chunk);
      if (error) throw error;
    }

    // G. Actualizar filas de importación exitosas en Supabase
    for (let i = 0; i < rowsCompletedIds.length; i += chunkSize) {
      const chunk = rowsCompletedIds.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('import_rows')
        .update({ estado: 'completed' })
        .in('id', chunk);
      if (error) throw error;
    }

    // H. Actualizar filas fallidas en Supabase
    for (const fail of rowsFailedUpdates) {
      await supabase
        .from('import_rows')
        .update({ estado: 'error', error_detalle: fail.error_detalle })
        .eq('id', fail.id);
    }

    // 5. Actualizar resumen final de la importación
    const finalState = failedCount > 0 ? 'completed_with_errors' : 'completed';
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
    const offerId = `offer-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const insertPayload: any = {
      id: offerId,
      nombre: offer.nombre,
      descripcion: offer.descripcion || null,
      precio_oferta: offer.precioOferta ?? offer.precio_oferta,
      precio_original: offer.precioOriginal ?? offer.precio_original,
      activo: offer.activo ?? true
    };
    if (offer.fechaFin || offer.fecha_fin) {
      insertPayload.fecha_fin = offer.fechaFin ? new Date(offer.fechaFin).toISOString() : new Date(offer.fecha_fin).toISOString();
    }

    const { error: offerErr } = await supabase
      .from('super_offers')
      .insert(insertPayload);

    if (offerErr) {
      if (insertPayload.fecha_fin) {
        delete insertPayload.fecha_fin;
        const { error: fallbackErr } = await supabase
          .from('super_offers')
          .insert(insertPayload);
        if (fallbackErr) throw fallbackErr;
      } else {
        throw offerErr;
      }
    }

    const offerItemsToInsert = items.map(item => ({
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      offer_id: offerId,
      product_id: item.productId || item.product_id,
      cantidad: item.cantidad,
      unidad: item.unidad || 'U'
    }));

    const { error: itemsErr } = await supabase
      .from('super_offer_items')
      .insert(offerItemsToInsert);
    if (itemsErr) throw itemsErr;

    return { id: offerId, ...offer };
  },

  getSuperOffers: async (isPublic?: boolean): Promise<any[]> => {
    const { data, error } = await supabase
      .from('super_offers')
      .select(isPublic ? `
        id, nombre, descripcion, activo, created_at, updated_at,
        super_offer_items (
          id, offer_id, product_id, cantidad, unidad, created_at,
          products:products (
            id, codigo, nombre, categoria, subcategoria, presentacion, unidad, descripcion, imagen, activo, visible_en_app, destacado
          )
        )
      ` : `
        *,
        super_offer_items (
          *,
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
        deleted_at: nowStr,
        updated_at: nowStr
      })
      .eq('id', id);

    if (error) {
      const { error: fallbackErr } = await supabase
        .from('super_offers')
        .update({
          activo: false,
          updated_at: nowStr
        })
        .eq('id', id);
      if (fallbackErr) throw fallbackErr;
    }
  }
};
