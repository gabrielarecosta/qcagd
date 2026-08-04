import request from 'supertest';
import app from './index';
import https from 'https';
import { EventEmitter } from 'events';

jest.mock('https');
jest.mock('@supabase/supabase-js', () => {
  return {
    createClient: jest.fn(() => ({
      auth: {
        getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'test-admin-id', email: 'admin@quimicadeheza.com' } }, error: null })),
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: { rol: 'admin' }, error: null })),
            single: jest.fn(() => Promise.resolve({ data: { rol: 'admin' }, error: null })),
          })),
          maybeSingle: jest.fn(() => Promise.resolve({ data: { depot_latitude: -32.7566, depot_longitude: -63.7861 }, error: null })),
          single: jest.fn(() => Promise.resolve({ data: { depot_latitude: -32.7566, depot_longitude: -63.7861 }, error: null })),
        })),
      })),
    })),
  };
});

describe('API Server - Geolocated Routing & Optimization Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // helper to mock https response
  const mockHttpsResponse = (statusCode: number, data: object | string) => {
    const mockReq = new EventEmitter() as any;
    mockReq.write = jest.fn();
    mockReq.end = jest.fn();
    mockReq.destroy = jest.fn();

    const mockRes = new EventEmitter() as any;
    mockRes.statusCode = statusCode;

    (https.request as jest.Mock).mockImplementation((options, callback) => {
      // Execute callback asynchronously to simulate response
      process.nextTick(() => {
        callback(mockRes);
        mockRes.emit('data', typeof data === 'string' ? data : JSON.stringify(data));
        mockRes.emit('end');
      });
      return mockReq;
    });
  };

  describe('Seguridad y Permisos', () => {
    it('debe rechazar solicitudes sin token de autorización', async () => {
      const res = await request(app).get('/api/geocoding/autocomplete?text=calle');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Falta cabecera');
    });

    it('debe permitir el acceso si se pasa token válido (o bypass de test)', async () => {
      mockHttpsResponse(200, { features: [] });
      const res = await request(app)
        .get('/api/geocoding/autocomplete?text=calle')
        .set('x-bypass-auth', 'true');
      expect(res.status).toBe(200);
    });
  });

  describe('Autocompletado y Geocodificación', () => {
    it('debe rechazar textos de menos de 3 caracteres en autocomplete', async () => {
      const res = await request(app)
        .get('/api/geocoding/autocomplete?text=ab')
        .set('x-bypass-auth', 'true');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('al menos 3 caracteres');
    });

    it('debe devolver resultados formateados de Geoapify Autocomplete', async () => {
      const mockResult = {
        features: [
          {
            geometry: { coordinates: [-63.7861, -32.7566] },
            properties: {
              place_id: 'place123',
              formatted: 'Bv. San Martín 123, General Deheza, Córdoba, Argentina',
              street: 'Bv. San Martín',
              housenumber: '123',
              city: 'General Deheza',
              state: 'Córdoba',
              postcode: '5923',
              country: 'Argentina',
            },
          },
        ],
      };

      mockHttpsResponse(200, mockResult);

      const res = await request(app)
        .get('/api/geocoding/autocomplete?text=San Martin 123')
        .set('x-bypass-auth', 'true');

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].placeId).toBe('place123');
      expect(res.body[0].latitude).toBe(-32.7566);
      expect(res.body[0].longitude).toBe(-63.7861);
    });

    it('debe validar coordenadas válidas en reverse geocoding', async () => {
      const res = await request(app)
        .post('/api/geocoding/reverse')
        .send({ latitude: 120, longitude: -63 }) // latitud 120 es invalida
        .set('x-bypass-auth', 'true');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('inválidas');
    });
  });

  describe('Optimización del Recorrido (Route Planner)', () => {
    it('debe mapear correctamente jobs a IDs de pedidos originales y retornar orden optimizado', async () => {
      const mockRoutePlannerResponse = {
        features: [
          {
            properties: {
              distance: 1200,
              duration: 350,
              actions: [
                { type: 'start', location: [-63.7861, -32.7566] },
                { type: 'job', action_id: 'order-a', start_time: 100, distance: 500, duration: 150 },
                { type: 'job', action_id: 'order-b', start_time: 300, distance: 700, duration: 200 },
                { type: 'end', location: [-63.7861, -32.7566] },
              ],
            },
          },
        ],
      };

      mockHttpsResponse(200, mockRoutePlannerResponse);

      const payload = {
        depot: { latitude: -32.7566, longitude: -63.7861 },
        orders: [
          { id: 'order-a', latitude: -32.7570, longitude: -63.7870, priority: 0 },
          { id: 'order-b', latitude: -32.7580, longitude: -63.7880, priority: 1 },
        ],
        returnsToDepot: true,
        stopDurationMinutes: 10,
      };

      const res = await request(app)
        .post('/api/routes/optimize')
        .send(payload)
        .set('x-bypass-auth', 'true');

      expect(res.status).toBe(200);
      expect(res.body.totalOrders).toBe(2);
      expect(res.body.stops[0].orderId).toBe('order-a');
      expect(res.body.stops[0].stopPosition).toBe(1);
      expect(res.body.stops[1].orderId).toBe('order-b');
      expect(res.body.stops[1].stopPosition).toBe(2);
    });

    it('debe admitir pedidos con coordenadas iguales (direcciones repetidas/mismo edificio)', async () => {
      const mockRoutePlannerResponse = {
        features: [
          {
            properties: {
              distance: 800,
              duration: 240,
              actions: [
                { type: 'start', location: [-63.7861, -32.7566] },
                { type: 'job', action_id: 'order-1', start_time: 80 },
                { type: 'job', action_id: 'order-2', start_time: 160 },
              ],
            },
          },
        ],
      };

      mockHttpsResponse(200, mockRoutePlannerResponse);

      const payload = {
        depot: { latitude: -32.7566, longitude: -63.7861 },
        orders: [
          { id: 'order-1', latitude: -32.7570, longitude: -63.7870 },
          { id: 'order-2', latitude: -32.7570, longitude: -63.7870 }, // coordenadas duplicadas
        ],
      };

      const res = await request(app)
        .post('/api/routes/optimize')
        .send(payload)
        .set('x-bypass-auth', 'true');

      expect(res.status).toBe(200);
      expect(res.body.stops.length).toBe(2);
      expect(res.body.stops[0].orderId).toBe('order-1');
      expect(res.body.stops[1].orderId).toBe('order-2');
    });
  });

  describe('Cálculo y Recálculo del Trazado (Routing)', () => {
    it('debe retornar la distancia y geometría GeoJSON para trazado de ruta', async () => {
      const mockRoutingResponse = {
        features: [
          {
            type: 'Feature',
            properties: { distance: 1500, time: 240 },
            geometry: {
              type: 'LineString',
              coordinates: [
                [-63.7861, -32.7566],
                [-63.7870, -32.7570],
              ],
            },
          },
        ],
      };

      mockHttpsResponse(200, mockRoutingResponse);

      const res = await request(app)
        .post('/api/routes/calculate')
        .send({
          waypoints: [
            { latitude: -32.7566, longitude: -63.7861 },
            { latitude: -32.7570, longitude: -63.7870 },
          ],
        })
        .set('x-bypass-auth', 'true');

      expect(res.status).toBe(200);
      expect(res.body.distance).toBe(1500);
      expect(res.body.geojson.type).toBe('Feature');
    });
  });
});
