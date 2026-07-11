import { supabase } from './supabaseClient';
import { Product, ProductStock, ProductCategory } from '../types/product';

const mapProduct = (d: any, rate: number = 1000): Product => {
  const isDolarizado = d.dolarizado || false;
  const precioUsd = Number(d.precio_usd || 0.0);
  const precioArs = isDolarizado ? Math.round(precioUsd * rate * 100) / 100 : Number(d.precio || 0.0);

  return {
    id: d.id,
    codigo: d.codigo,
    nombre: d.nombre,
    categoria: d.categoria as ProductCategory,
    subcategoria: d.subcategoria || undefined,
    presentacion: d.presentacion,
    unidad: d.unidad || 'unidad',
    precio: precioArs,
    precioMayorista: d.precio_mayorista ? Number(d.precio_mayorista) : undefined,
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

  getAll: async (branchId?: string): Promise<(Product & { stock: number; stockMinimo: number })[]> => {
    const rate = await productService.getLatestExchangeRate();
    const { data: prods, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .is('deleted_at', null);

    if (prodErr) throw prodErr;

    const targetBranch = branchId && branchId !== 'all' ? branchId : 'branch-gd1';
    const { data: stocks, error: stockErr } = await supabase
      .from('inventory')
      .select('*')
      .eq('branch_id', targetBranch);

    if (stockErr) throw stockErr;

    return (prods || []).map((p: any) => {
      const stockInfo = (stocks || []).find((s: any) => s.product_id === p.id);
      return {
        ...mapProduct(p, rate),
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
          usuario_responsable: userMail || 'admin@quimicadeheza.com'
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

  updateStock: async (productId: string, branchId: string, qty: number, minQty?: number, userMail?: string): Promise<ProductStock> => {
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
          motivo: 'Ajuste manual de stock desde el panel',
          usuario_responsable: userMail || 'admin@quimicadeheza.com'
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
        usuario_responsable: userMail || 'admin@quimicadeheza.com'
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

    // 2. Obtener todas las filas de la importación
    const { data: rowsData, error: rowsErr } = await supabase
      .from('import_rows')
      .select('*')
      .eq('import_id', importId);
    if (rowsErr) throw rowsErr;

    const stagedRows = (rowsData || []).map(r => ({
      rowDbId: r.id,
      ...r.datos
    }));

    let createdCount = 0;
    let updatedCount = 0;
    let codeReplacedCount = 0;
    let failedCount = 0;
    const errorsList: any[] = [];

    for (const sRow of stagedRows) {
      // Omitir filas ignoradas o con error inicial que no se resolvieron
      if (sRow.estado === 'ignored' || sRow.estado === 'error') {
        continue;
      }

      try {
        const prodData = {
          codigo: sRow.codigo.trim().toUpperCase(),
          nombre: sRow.descripcion.trim(),
          precio: Number(sRow.precio),
          activo: true,
          visible_en_app: true,
          unidad: 'unidad',
          presentacion: 'Presentación Importada',
          categoria: 'limpieza' // Categoría por defecto requerida por la base
        } as any;

        // Agregar marca si tiene valor
        if (sRow.marca) {
          prodData.marca = sRow.marca.trim();
        }

        let targetProductId = sRow.matchedProductId;
        const oldCode = sRow.matchedProductCode;

        if (sRow.action === 'create_new') {
          // Generar nuevo UUID para el producto
          targetProductId = `prod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const { error: insErr } = await supabase
            .from('products')
            .insert({
              id: targetProductId,
              ...prodData
            });
          if (insErr) throw insErr;
          createdCount++;

          // Registrar en historial de precios inicial
          await supabase.from('product_prices').insert({
            product_id: targetProductId,
            precio_anterior: 0,
            precio_nuevo: prodData.precio,
            cambio_tipo: 'masivo',
            usuario_responsable: userEmail,
            criterio: 'Importación inicial de catálogo'
          });

        } else if (sRow.action === 'update_by_code' && targetProductId) {
          // Leer precio actual para auditoría e historial
          const { data: currentProd } = await supabase
            .from('products')
            .select('precio, nombre, descripcion, marca')
            .eq('id', targetProductId)
            .single();

          const prevPrice = currentProd ? Number(currentProd.precio) : 0;
          
          // Actualizar producto en base de datos sin pisar descripción ni marca si vienen vacías
          const updates: any = {};
          if (sRow.descripcion) updates.nombre = sRow.descripcion;
          if (sRow.marca) updates.marca = sRow.marca;
          updates.precio = prodData.precio;
          updates.updated_at = new Date().toISOString();

          const { error: updProdErr } = await supabase
            .from('products')
            .update(updates)
            .eq('id', targetProductId);
          if (updProdErr) throw updProdErr;
          updatedCount++;

          // Registrar en historial de precios si cambió
          if (prevPrice !== prodData.precio) {
            await supabase.from('product_prices').insert({
              product_id: targetProductId,
              precio_anterior: prevPrice,
              precio_nuevo: prodData.precio,
              cambio_tipo: 'masivo',
              usuario_responsable: userEmail,
              criterio: 'Importación diaria por código'
            });
          }

        } else if (sRow.action === 'replace_code' && targetProductId && oldCode) {
          // Reemplazo de código de fábrica por descripción coincidente
          const { data: currentProd } = await supabase
            .from('products')
            .select('precio, codigo, nombre')
            .eq('id', targetProductId)
            .single();

          const prevPrice = currentProd ? Number(currentProd.precio) : 0;

          // Reemplazar código comercial y actualizar datos del producto
          const updates: any = {
            codigo: sRow.codigo.trim().toUpperCase()
          };
          if (sRow.descripcion) updates.nombre = sRow.descripcion;
          if (sRow.marca) updates.marca = sRow.marca;
          updates.precio = prodData.precio;
          updates.updated_at = new Date().toISOString();

          const { error: replaceErr } = await supabase
            .from('products')
            .update(updates)
            .eq('id', targetProductId);
          if (replaceErr) throw replaceErr;
          codeReplacedCount++;

          // Registrar en product_code_history
          await supabase.from('product_code_history').insert({
            product_id: targetProductId,
            old_code: oldCode,
            new_code: updates.codigo,
            changed_by: userEmail,
            import_id: importId,
            reason: 'manufacturer_code_change',
            source: 'daily_excel_import'
          });

          // Registrar en audit_logs
          await supabase.from('audit_logs').insert({
            usuario: userEmail,
            accion: 'UPDATE',
            entidad: 'products',
            registro_id: targetProductId,
            valores_anteriores: { codigo: oldCode, precio: prevPrice },
            valores_nuevos: { codigo: updates.codigo, precio: prodData.precio },
            origen: 'frontend',
            observacion: `Reemplazo de código comercial por coincidencia única de descripción ("${sRow.descripcion}").`,
            referencia_relacionada: importId
          });

          // Registrar en historial de precios si cambió
          if (prevPrice !== prodData.precio) {
            await supabase.from('product_prices').insert({
              product_id: targetProductId,
              precio_anterior: prevPrice,
              precio_nuevo: prodData.precio,
              cambio_tipo: 'masivo',
              usuario_responsable: userEmail,
              criterio: 'Importación diaria con cambio de código'
            });
          }
        }

        // ────────── Sincronización de Stock Absoluto en la Sucursal ──────────
        if (targetProductId) {
          // Obtener stock actual en la sucursal seleccionada
          const { data: currentStockData } = await supabase
            .from('inventory')
            .select('stock')
            .eq('product_id', targetProductId)
            .eq('branch_id', branchId)
            .maybeSingle();

          const previousStock = currentStockData ? Number(currentStockData.stock) : 0;
          const importedStock = Number(sRow.stock);
          const difference = importedStock - previousStock;

          // Upsert en la tabla de inventario
          const { error: stockUpdErr } = await supabase
            .from('inventory')
            .upsert({
              product_id: targetProductId,
              branch_id: branchId,
              stock: importedStock,
              disponible: importedStock > 0,
              updated_at: new Date().toISOString()
            }, { onConflict: 'product_id,branch_id' });
          if (stockUpdErr) throw stockUpdErr;

          // Registrar movimiento de stock diario si hay diferencia
          if (difference !== 0) {
            await supabase.from('inventory_movements').insert({
              product_id: targetProductId,
              branch_id: branchId,
              cantidad_anterior: previousStock,
              cantidad_modificada: difference,
              cantidad_resultante: importedStock,
              tipo_movimiento: 'importacion',
              motivo: 'Sincronización diaria absoluta de stock',
              importacion_id: importId,
              usuario_responsable: userEmail
            });
          }
        }

        // Marcar fila de importación como exitosamente completada
        await supabase
          .from('import_rows')
          .update({ estado: 'completed' })
          .eq('id', sRow.rowDbId);

      } catch (err: any) {
        failedCount++;
        errorsList.push({ fila: sRow.filaNumero, error: err.message || String(err) });
        // Marcar fila de importación con error
        await supabase
          .from('import_rows')
          .update({ estado: 'error', error_detalle: err.message || String(err) })
          .eq('id', sRow.rowDbId);
      }
    }

    // Actualizar resumen final del registro de importación
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
  }
};
