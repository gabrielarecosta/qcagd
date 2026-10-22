import { supabase } from './supabaseClient';

export interface CartItemPayload {
  producto: any;
  cantidad: number;
  shadowCopy?: boolean;
}

export interface AbandonedCart {
  userId: string;
  items: CartItemPayload[];
  updatedAt: string;
  createdAt?: string;
  customer?: {
    id: number | string;
    userId?: string;
    nombre: string;
    razonSocial?: string;
    email?: string;
    telefono?: string;
    whatsapp?: string;
    localidad?: string;
    branchId?: number;
    tipoCliente?: string;
  };
  totalEstimated: number;
  totalQuantity: number;
}

export type CustomerPriceRole = 'socio' | 'mayorista' | 'minorista';

/**
 * Normaliza el tipo de cliente para determinar su lista de precios:
 * - 'socio' | 'socios' -> 'socio' (Lista 4)
 * - 'mayorista' -> 'mayorista' (Lista 3)
 * - 'minorista' | 'consumidor_final' | default -> 'minorista' (Lista 1)
 */
export function normalizeCustomerRole(raw?: string | null): CustomerPriceRole {
  if (!raw) return 'minorista';
  const norm = String(raw).trim().toLowerCase();
  if (norm === 'socio' || norm === 'socios') return 'socio';
  if (norm === 'mayorista') return 'mayorista';
  return 'minorista';
}

/**
 * Obtiene el precio unitario correspondiente de un producto según el rol del cliente:
 * - Socio: Lista 4 (precioSocios o precio_socios). Si no existe o <= 0, usa precio minorista.
 * - Mayorista: Lista 3 (precioMayorista o precio_mayorista). Si no existe o <= 0, usa precio minorista.
 * - Minorista: Lista 1 (precio).
 */
export function getProductPriceForCustomerRole(
  product: any,
  customerRole: CustomerPriceRole
): number {
  if (!product) return 0;
  const minorista = Number(product.precio ?? product.precioMinorista ?? product.precio_venta ?? 0);
  const mayoristaRaw = product.precioMayorista ?? product.precio_mayorista;
  const sociosRaw = product.precioSocios ?? product.precio_socios;

  const mayorista = mayoristaRaw !== undefined && mayoristaRaw !== null && Number(mayoristaRaw) > 0
    ? Number(mayoristaRaw)
    : minorista;
  const socios = sociosRaw !== undefined && sociosRaw !== null && Number(sociosRaw) > 0
    ? Number(sociosRaw)
    : minorista;

  if (customerRole === 'socio') return socios;
  if (customerRole === 'mayorista') return mayorista;
  return minorista;
}

/**
 * Aplica la lista de precios que le corresponde al cliente a un objeto producto.
 * Permite sincronizar opcionalmente con los datos maestros del producto si se provee dbProd.
 */
export function applyPriceListToProduct(
  prod: any,
  customerRole: CustomerPriceRole,
  dbProd?: any
): any {
  const source = dbProd || prod;
  const minoristaPrice = Number(source.precio ?? source.precioMinorista ?? 0);
  const mayoristaPrice = (source.precioMayorista ?? source.precio_mayorista) != null && Number(source.precioMayorista ?? source.precio_mayorista) > 0
    ? Number(source.precioMayorista ?? source.precio_mayorista)
    : minoristaPrice;
  const sociosPrice = (source.precioSocios ?? source.precio_socios) != null && Number(source.precioSocios ?? source.precio_socios) > 0
    ? Number(source.precioSocios ?? source.precio_socios)
    : minoristaPrice;

  const assignedPrice = getProductPriceForCustomerRole(source, customerRole);

  return {
    ...prod,
    ...(dbProd ? {
      id: dbProd.id,
      codigo: dbProd.codigo || prod.codigo,
      nombre: dbProd.nombre || prod.nombre,
      presentacion: dbProd.presentacion !== undefined ? dbProd.presentacion : prod.presentacion,
      unidad: dbProd.unidad || prod.unidad || 'unidad',
      categoria: dbProd.categoria || prod.categoria,
      marca: dbProd.marca !== undefined ? dbProd.marca : prod.marca,
      imagen: dbProd.imagen || prod.imagen,
      activo: dbProd.activo ?? true,
    } : {}),
    precio: assignedPrice,
    precioFinal: assignedPrice,
    precioVenta: assignedPrice,
    precio_venta: assignedPrice,
    precioMinorista: minoristaPrice,
    precioMayorista: mayoristaPrice,
    precioSocios: sociosPrice,
    precio_mayorista: mayoristaPrice,
    precio_socios: sociosPrice,
    roleListaAplicada: customerRole === 'socio' ? 'Lista 4 (Socios)' : customerRole === 'mayorista' ? 'Lista 3 (Mayorista)' : 'Lista 1 (Minorista)',
  };
}

export const cartService = {
  /**
   * Obtiene los ítems guardados del carrito de un usuario desde Supabase
   */
  async getByUserId(userId: string): Promise<CartItemPayload[]> {
    if (!userId) return [];
    try {
      const cleanId = String(userId).trim();
      const { data, error } = await supabase
        .from('user_carts')
        .select('items')
        .eq('user_id', cleanId)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('does not exist')) {
          console.warn('La tabla user_carts aún no existe en Supabase DB.');
          return [];
        }
        console.error('Error al obtener carrito del usuario:', error.message);
        return [];
      }

      if (!data || !Array.isArray(data.items)) {
        return [];
      }

      return data.items as CartItemPayload[];
    } catch (err) {
      console.error('Error imprevisto al obtener carrito:', err);
      return [];
    }
  },

  /**
   * Guarda / Actualiza los ítems del carrito de un usuario en Supabase (UPSERT)
   */
  async saveUserCart(userId: string, items: CartItemPayload[]): Promise<boolean> {
    if (!userId) return false;
    try {
      const cleanId = String(userId).trim();
      const payload = {
        user_id: cleanId,
        items: Array.isArray(items) ? items : [],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_carts')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('does not exist')) {
          return false;
        }
        console.error('Error al guardar carrito del usuario en DB:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error imprevisto al guardar carrito:', err);
      return false;
    }
  },

  /**
   * Vacía o elimina el carrito guardado del usuario en Supabase
   */
  async clearUserCart(userId: string): Promise<boolean> {
    if (!userId) return false;
    try {
      const cleanId = String(userId).trim();
      const { error } = await supabase
        .from('user_carts')
        .update({ items: [], updated_at: new Date().toISOString() })
        .eq('user_id', cleanId);

      if (error) {
        console.error('Error al limpiar carrito del usuario en DB:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error imprevisto al limpiar carrito:', err);
      return false;
    }
  },

  /**
   * Refresca los ítems del carrito de un usuario específico aplicando su lista de precios
   * correspondiente (socio, minorista, mayorista) y actualiza la base de datos si hubo cambios.
   */
  async refreshUserCartPrices(userId: string, explicitCustomerType?: string): Promise<CartItemPayload[]> {
    if (!userId) return [];
    try {
      const cleanId = String(userId).trim();
      const currentItems = await this.getByUserId(cleanId);
      if (!currentItems || currentItems.length === 0) return [];

      let role = normalizeCustomerRole(explicitCustomerType);

      // Si no se pasó explícito, consultar tipo_cliente en Supabase
      if (!explicitCustomerType) {
        const { data: cust } = await supabase
          .from('customers')
          .select('tipo_cliente')
          .or(`id.eq.${cleanId},user_id.eq.${cleanId}`)
          .maybeSingle();

        if (cust) {
          role = normalizeCustomerRole(cust.tipo_cliente);
        }
      }

      // Obtener productos de los ítems en el carrito
      const productIds = currentItems
        .map(i => i.producto?.id)
        .filter(Boolean)
        .map(String);

      let dbProds: any[] = [];
      if (productIds.length > 0) {
        const { data } = await supabase
          .from('products')
          .select('id, codigo, nombre, presentacion, unidad, categoria, marca, imagen, activo, deleted_at, precio, precio_mayorista, precio_socios')
          .in('id', productIds);
        dbProds = data || [];
      }

      const prodMap = new Map<string, any>();
      dbProds.forEach(p => {
        if (p.id != null) prodMap.set(String(p.id).trim(), p);
      });

      let changed = false;
      const updatedItems: CartItemPayload[] = currentItems.map(item => {
        if (!item || !item.producto) return item;
        const dbProd = prodMap.get(String(item.producto.id).trim());
        const updatedProd = applyPriceListToProduct(item.producto, role, dbProd);

        if (
          Number(item.producto.precio ?? 0) !== Number(updatedProd.precio ?? 0) ||
          item.producto.precioMayorista !== updatedProd.precioMayorista ||
          item.producto.precioSocios !== updatedProd.precioSocios
        ) {
          changed = true;
        }

        return {
          ...item,
          producto: updatedProd,
        };
      });

      if (changed) {
        await this.saveUserCart(cleanId, updatedItems);
      }

      return updatedItems;
    } catch (err) {
      console.warn('Error al refrescar precios de carrito de usuario:', err);
      return this.getByUserId(userId);
    }
  },

  /**
   * Actualiza todos los carritos guardados en user_carts aplicando a cada producto
   * la lista de precios que le corresponde al usuario según su tipo (socio, minorista, mayorista).
   * Se ejecuta luego de importaciones de catálogo Excel o cambios masivos/individuales de precios.
   */
  async updateAllSavedCartsWithPriceLists(): Promise<{
    cartsUpdated: number;
    itemsUpdated: number;
    totalCarts: number;
  }> {
    try {
      // 1. Obtener todos los carritos guardados de user_carts
      const { data: carts, error: cartErr } = await supabase
        .from('user_carts')
        .select('user_id, items');

      if (cartErr) {
        if (cartErr.code === 'PGRST204' || cartErr.message?.includes('does not exist')) {
          return { cartsUpdated: 0, itemsUpdated: 0, totalCarts: 0 };
        }
        console.error('Error al obtener carritos para actualización de precios:', cartErr.message);
        return { cartsUpdated: 0, itemsUpdated: 0, totalCarts: 0 };
      }

      if (!carts || carts.length === 0) {
        return { cartsUpdated: 0, itemsUpdated: 0, totalCarts: 0 };
      }

      // Filtrar únicamente los carritos con ítems
      const cartsWithItems = carts.filter(c => Array.isArray(c.items) && c.items.length > 0);
      if (cartsWithItems.length === 0) {
        return { cartsUpdated: 0, itemsUpdated: 0, totalCarts: 0 };
      }

      // 2. Obtener clientes para asociar tipo_cliente (con paginación para evitar límites de PostgREST)
      let allCustomers: any[] = [];
      let cPage = 0;
      let cHasMore = true;
      const pageSize = 1000;

      while (cHasMore) {
        const from = cPage * pageSize;
        const to = from + pageSize - 1;
        const { data: cChunk, error: cErr } = await supabase
          .from('customers')
          .select('id, user_id, tipo_cliente')
          .is('deleted_at', null)
          .range(from, to);

        if (cErr) {
          console.warn('Error cargando clientes en updateAllSavedCartsWithPriceLists:', cErr.message);
          cHasMore = false;
        } else if (!cChunk || cChunk.length === 0) {
          cHasMore = false;
        } else {
          allCustomers = allCustomers.concat(cChunk);
          if (cChunk.length < pageSize) cHasMore = false;
          else cPage++;
        }
      }

      const customerMap = new Map<string, any>();
      allCustomers.forEach(cust => {
        if (cust.id) customerMap.set(String(cust.id).trim(), cust);
        if (cust.user_id) customerMap.set(String(cust.user_id).trim(), cust);
      });

      // 3. Obtener catálogo completo de productos con paginación
      let allProducts: any[] = [];
      let pPage = 0;
      let pHasMore = true;

      while (pHasMore) {
        const from = pPage * pageSize;
        const to = from + pageSize - 1;
        const { data: pChunk, error: pErr } = await supabase
          .from('products')
          .select('id, codigo, nombre, presentacion, unidad, categoria, marca, imagen, activo, deleted_at, precio, precio_mayorista, precio_socios')
          .is('deleted_at', null)
          .range(from, to);

        if (pErr) {
          console.error('Error cargando catálogo en updateAllSavedCartsWithPriceLists:', pErr.message);
          pHasMore = false;
        } else if (!pChunk || pChunk.length === 0) {
          pHasMore = false;
        } else {
          allProducts = allProducts.concat(pChunk);
          if (pChunk.length < pageSize) pHasMore = false;
          else pPage++;
        }
      }

      const prodById = new Map<string, any>();
      const prodByCode = new Map<string, any>();

      allProducts.forEach(p => {
        if (p.id != null) prodById.set(String(p.id).trim(), p);
        if (p.codigo) prodByCode.set(String(p.codigo).trim().toUpperCase(), p);
      });

      // 4. Actualizar cada carrito guardado con la lista de precios que le corresponde
      let cartsUpdated = 0;
      let itemsUpdated = 0;

      for (const cart of cartsWithItems) {
        const rawUserId = String(cart.user_id).trim();
        const customer = customerMap.get(rawUserId);
        const role = normalizeCustomerRole(customer?.tipo_cliente);

        let cartModified = false;
        const updatedItems: CartItemPayload[] = [];

        for (const item of (cart.items as CartItemPayload[])) {
          if (!item || !item.producto) {
            updatedItems.push(item);
            continue;
          }

          const currentProd = item.producto;
          const pId = currentProd.id != null ? String(currentProd.id).trim() : null;
          const pCode = currentProd.codigo ? String(currentProd.codigo).trim().toUpperCase() : null;

          const dbProd = (pId && prodById.get(pId)) || (pCode && prodByCode.get(pCode));
          const updatedProd = applyPriceListToProduct(currentProd, role, dbProd);

          const oldPrice = Number(currentProd.precio ?? 0);
          const newPrice = Number(updatedProd.precio ?? 0);

          if (
            oldPrice !== newPrice ||
            currentProd.precioMayorista !== updatedProd.precioMayorista ||
            currentProd.precioSocios !== updatedProd.precioSocios ||
            currentProd.nombre !== updatedProd.nombre ||
            currentProd.activo !== updatedProd.activo
          ) {
            cartModified = true;
            itemsUpdated++;
          }

          updatedItems.push({
            ...item,
            producto: updatedProd,
          });
        }

        if (cartModified) {
          const { error: updErr } = await supabase
            .from('user_carts')
            .update({
              items: updatedItems,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', rawUserId);

          if (!updErr) {
            cartsUpdated++;
          } else {
            console.warn(`Error al actualizar carrito de usuario ${rawUserId}:`, updErr.message);
          }
        }
      }

      console.log(`[cartService] updateAllSavedCartsWithPriceLists: ${cartsUpdated} carritos actualizados con sus listas de precios (socio, minorista, mayorista).`);

      return {
        cartsUpdated,
        itemsUpdated,
        totalCarts: cartsWithItems.length,
      };
    } catch (err) {
      console.error('Error imprevisto en updateAllSavedCartsWithPriceLists:', err);
      return { cartsUpdated: 0, itemsUpdated: 0, totalCarts: 0 };
    }
  },

  /**
   * Obtiene todos los carritos abandonados (con ítems > 0) con datos de cliente vinculados
   * y precios calculados según la lista de precios que le corresponde al cliente.
   */
  async getAbandonedCarts(branchId?: string | number): Promise<AbandonedCart[]> {
    try {
      const { data: carts, error: cartErr } = await supabase
        .from('user_carts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (cartErr) {
        if (cartErr.code === 'PGRST204' || cartErr.message?.includes('does not exist')) {
          return [];
        }
        console.error('Error al obtener carritos abandonados:', cartErr.message);
        return [];
      }

      if (!carts || carts.length === 0) return [];

      // Filtrar sólo los carritos que tengan al menos 1 producto
      const cartsWithItems = carts.filter(c => Array.isArray(c.items) && c.items.length > 0);
      if (cartsWithItems.length === 0) return [];

      // Obtener todos los clientes para cruzar los datos
      const { data: customers } = await supabase
        .from('customers')
        .select('id, user_id, nombre, razon_social, email, telefono, whatsapp, localidad, branch_id, tipo_cliente')
        .is('deleted_at', null);

      const customerMap = new Map<string, any>();
      (customers || []).forEach(cust => {
        if (cust.id) customerMap.set(String(cust.id).trim(), cust);
        if (cust.user_id) customerMap.set(String(cust.user_id).trim(), cust);
      });

      const parsedBranch = branchId !== undefined && branchId !== null && branchId !== 'all' ? Number(branchId) : undefined;

      const results: AbandonedCart[] = [];

      for (const cart of cartsWithItems) {
        const uid = String(cart.user_id).trim();
        const cust = customerMap.get(uid);

        // Si se especificó una sucursal y conocemos la sucursal del cliente, filtrar
        if (parsedBranch !== undefined && !isNaN(parsedBranch) && cust && cust.branch_id && Number(cust.branch_id) !== parsedBranch) {
          continue;
        }

        const role = normalizeCustomerRole(cust?.tipo_cliente);
        const rawItems: CartItemPayload[] = cart.items || [];
        const items: CartItemPayload[] = rawItems.map(it => {
          if (!it || !it.producto) return it;
          return {
            ...it,
            producto: applyPriceListToProduct(it.producto, role),
          };
        });

        let totalEstimated = 0;
        let totalQuantity = 0;

        for (const it of items) {
          const qty = Number(it.cantidad || 0);
          totalQuantity += qty;
          const p = it.producto || {};
          const price = Number(p.precioFinal ?? p.precioVenta ?? p.precio_venta ?? p.precio ?? 0);
          totalEstimated += price * qty;
        }

        results.push({
          userId: uid,
          items,
          updatedAt: cart.updated_at || cart.created_at || new Date().toISOString(),
          createdAt: cart.created_at,
          customer: cust ? {
            id: cust.id,
            userId: cust.user_id,
            nombre: cust.nombre,
            razonSocial: cust.razon_social,
            email: cust.email,
            telefono: cust.telefono,
            whatsapp: cust.whatsapp,
            localidad: cust.localidad,
            branchId: cust.branch_id,
            tipoCliente: cust.tipo_cliente,
          } : undefined,
          totalEstimated,
          totalQuantity,
        });
      }

      return results;
    } catch (err) {
      console.error('Error al cargar carritos abandonados:', err);
      return [];
    }
  },

  /**
   * Permite al admin descartar o vaciar el carrito abandonado de un usuario
   */
  async adminClearCart(userId: string): Promise<boolean> {
    return this.clearUserCart(userId);
  }
};
