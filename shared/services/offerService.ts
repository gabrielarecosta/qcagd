import { Product } from '../types';
import { supabase } from './supabaseClient';

export interface Promotion {
  id: string;
  product_id: string;
  descuento_porcentaje: number;
  cantidad_minima: number;
  fecha_inicio: string;
  fecha_fin: string;
  tipo_cliente: 'mayorista' | 'minorista' | 'socio' | 'socios' | 'todos';
  activo: boolean;
}

export const offerService = {
  /**
   * Obtiene todas las promociones vigentes de productos de la base de datos
   */
  getActivePromotions: async (): Promise<Promotion[]> => {
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('product_promotions')
        .select('*')
        .eq('activo', true)
        .lte('fecha_inicio', now)
        .gte('fecha_fin', now);
        
      if (error) {
        // Si la tabla no está creada aún en la base de datos local/dev,
        // retornamos una lista vacía para evitar crash
        console.warn('⚠️ No se pudieron obtener promociones (¿tabla product_promotions no migrada?):', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Error fetching product promotions:', e);
      return [];
    }
  },

  /**
   * Calcula el precio final, descuento aplicado y subtotal para un producto y cantidad dados
   * - Minorista / Público General: Lista 1 (product.precio)
   * - Mayorista: Lista 3 (product.precioMayorista)
   * - Socio / Socios: Lista 4 (product.precioSocios)
   */
  calculateFinalPrice: (
    product: Product,
    quantity: number,
    customerType: string = 'minorista',
    promotions: Promotion[] = []
  ) => {
    const minoristaBasePrice = Number(product.precio || 0);
    const mayoristaBasePrice = product.precioMayorista && Number(product.precioMayorista) > 0
      ? Number(product.precioMayorista)
      : minoristaBasePrice;
    const sociosBasePrice = product.precioSocios && Number(product.precioSocios) > 0
      ? Number(product.precioSocios)
      : minoristaBasePrice;

    const normType = String(customerType || '').toLowerCase().trim();
    const isMayorista = normType === 'mayorista';
    const isSocio = normType === 'socio' || normType === 'socios';

    // Determinar precio base inicial según rol
    let basePrice = minoristaBasePrice;
    if (isSocio) {
      basePrice = sociosBasePrice;
    } else if (isMayorista) {
      basePrice = mayoristaBasePrice;
    }

    // Filtrar promociones aplicables para este producto y tipo de cliente
    const applicablePromos = promotions.filter(
      (p) =>
        p.product_id === product.id &&
        p.activo &&
        (p.tipo_cliente === 'todos' || 
         p.tipo_cliente === customerType || 
         (isSocio && (p.tipo_cliente === 'socio' || p.tipo_cliente === 'socios')) ||
         (isMayorista && p.tipo_cliente === 'mayorista'))
    );

    // Encontrar la mejor promoción que califique según cantidad_minima
    const qualifyingPromos = applicablePromos.filter((p) => quantity >= p.cantidad_minima);
    
    let bestPromo: Promotion | null = null;
    if (qualifyingPromos.length > 0) {
      bestPromo = qualifyingPromos.reduce((prev, curr) => 
        Number(curr.descuento_porcentaje) > Number(prev.descuento_porcentaje) ? curr : prev
      );
    }

    let subtotal = basePrice * quantity;
    let priceFinal = basePrice;
    let discountApplied = 0;
    let bestDiscountPercent = 0;

    if (bestPromo) {
      bestDiscountPercent = Number(bestPromo.descuento_porcentaje);
      const bundleMin = bestPromo.cantidad_minima;
      const numBundles = Math.floor(quantity / bundleMin);
      const promoQuantity = numBundles * bundleMin;
      const regularQuantity = quantity - promoQuantity;

      const promoPrice = basePrice * ((100 - bestDiscountPercent) / 100);
      subtotal = (promoPrice * promoQuantity) + (basePrice * regularQuantity);
      priceFinal = subtotal / quantity;
      discountApplied = basePrice - priceFinal;
    }

    return {
      priceOriginal: basePrice,
      discountApplied,
      discountPercent: bestDiscountPercent,
      priceFinal,
      subtotal,
    };
  },
};
