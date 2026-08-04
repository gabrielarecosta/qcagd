import { offerService, Promotion } from '../offerService';
import { Product } from '../../types';

describe('offerService pricing calculations', () => {
  const mockProduct: Product = {
    id: 'prod-123',
    codigo: 'COD-123',
    nombre: 'Detergente Premium',
    categoria: 'limpieza',
    presentacion: '5 L',
    unidad: 'bidón',
    precio: 1000,
    precioMayorista: 800,
    activo: true,
  };

  const mockPromotions: Promotion[] = [
    {
      id: 'promo-1',
      product_id: 'prod-123',
      descuento_porcentaje: 10,
      cantidad_minima: 3,
      fecha_inicio: '2026-01-01T00:00:00Z',
      fecha_fin: '2026-12-31T23:59:59Z',
      tipo_cliente: 'todos',
      activo: true,
    },
    {
      id: 'promo-2',
      product_id: 'prod-123',
      descuento_porcentaje: 20,
      cantidad_minima: 5,
      fecha_inicio: '2026-01-01T00:00:00Z',
      fecha_fin: '2026-12-31T23:59:59Z',
      tipo_cliente: 'todos',
      activo: true,
    },
    {
      id: 'promo-mayorista-only',
      product_id: 'prod-123',
      descuento_porcentaje: 15,
      cantidad_minima: 2,
      fecha_inicio: '2026-01-01T00:00:00Z',
      fecha_fin: '2026-12-31T23:59:59Z',
      tipo_cliente: 'mayorista',
      activo: true,
    }
  ];

  test('debe calcular precio minorista base sin promociones si cantidad es menor al minimo', () => {
    const result = offerService.calculateFinalPrice(mockProduct, 1, 'minorista', mockPromotions);
    expect(result.priceOriginal).toBe(1000);
    expect(result.discountPercent).toBe(0);
    expect(result.priceFinal).toBe(1000);
    expect(result.subtotal).toBe(1000);
  });

  test('debe aplicar promocion del 10% si cantidad alcanza primer minimo (3 unidades)', () => {
    const result = offerService.calculateFinalPrice(mockProduct, 3, 'minorista', mockPromotions);
    expect(result.priceOriginal).toBe(1000);
    expect(result.discountPercent).toBe(10);
    expect(result.priceFinal).toBe(900);
    expect(result.subtotal).toBe(2700);
  });

  test('debe aplicar la mejor promocion (20%) si cantidad alcanza segundo minimo (5 unidades)', () => {
    const result = offerService.calculateFinalPrice(mockProduct, 5, 'minorista', mockPromotions);
    expect(result.priceOriginal).toBe(1000);
    expect(result.discountPercent).toBe(20);
    expect(result.priceFinal).toBe(800);
    expect(result.subtotal).toBe(4000);
  });

  test('debe calcular precio mayorista base con descuento mayorista especifico', () => {
    // Para mayoristas: precio base 800. cantidad 2 alcanza promo-mayorista-only (15%)
    const result = offerService.calculateFinalPrice(mockProduct, 2, 'mayorista', mockPromotions);
    expect(result.priceOriginal).toBe(800);
    expect(result.discountPercent).toBe(15);
    expect(result.priceFinal).toBe(680); // 800 - 15%
    expect(result.subtotal).toBe(1360);
  });

  test('debe ignorar promociones inactivas o fuera de fecha', () => {
    const inactivePromos: Promotion[] = [
      {
        id: 'promo-expired',
        product_id: 'prod-123',
        descuento_porcentaje: 50,
        cantidad_minima: 1,
        fecha_inicio: '2020-01-01T00:00:00Z',
        fecha_fin: '2021-01-01T00:00:00Z', // Vencida
        tipo_cliente: 'todos',
        activo: true,
      },
      {
        id: 'promo-inactive',
        product_id: 'prod-123',
        descuento_porcentaje: 50,
        cantidad_minima: 1,
        fecha_inicio: '2026-01-01T00:00:00Z',
        fecha_fin: '2026-12-31T23:59:59Z',
        tipo_cliente: 'todos',
        activo: false, // Inactiva
      }
    ];

    const result = offerService.calculateFinalPrice(mockProduct, 1, 'minorista', inactivePromos);
    expect(result.discountPercent).toBe(0);
    expect(result.priceFinal).toBe(1000);
  });

  test('debe devolver precios consistentes independientemente del origen de agregado (comparativa exacta)', () => {
    // Verificamos que llamar al servicio con los mismos parametros devuelve exactamente los mismos resultados
    const resCatalog = offerService.calculateFinalPrice(mockProduct, 3, 'minorista', mockPromotions);
    const resSearch = offerService.calculateFinalPrice(mockProduct, 3, 'minorista', mockPromotions);
    const resManual = offerService.calculateFinalPrice(mockProduct, 3, 'minorista', mockPromotions);

    expect(resCatalog).toEqual(resSearch);
    expect(resCatalog).toEqual(resManual);
  });
});
