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
  }
};
