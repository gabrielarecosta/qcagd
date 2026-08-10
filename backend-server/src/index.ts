import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import https from 'https';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Supabase Init
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
  throw new Error(
    '❌ SUPABASE_URL no está configurada o es inválida. ' +
    'Revisá el archivo .env del backend-server (debe empezar con https://).'
  );
}
if (!supabaseAnonKey || supabaseAnonKey.startsWith('your_')) {
  throw new Error(
    '❌ SUPABASE_ANON_KEY no está configurada. ' +
    'Revisá el archivo .env del backend-server.'
  );
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);


app.use(cors());
app.use(express.json());

// Extend express request types
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    rol?: string;
  };
}

// ------------------------------------------------------------
// MIDDLEWARES
// ------------------------------------------------------------

// Supabase JWT Authenticator and Role checker
const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  // Allow bypassing auth in test environment via header
  if (process.env.NODE_ENV === 'test' && req.headers['x-bypass-auth'] === 'true') {
    req.user = {
      id: 'test-admin-id',
      email: 'admin@quimicadeheza.com',
      rol: 'admin'
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Falta cabecera de autorización Bearer Token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      res.status(401).json({ error: 'Token de acceso inválido o expirado' });
      return;
    }

    // Obtener rol del perfil
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('rol')
      .eq('id', user.id)
      .maybeSingle();

    if (profErr || !profile) {
      res.status(403).json({ error: 'No se encontró un perfil de colaborador asociado' });
      return;
    }

    const rol = profile.rol;
    if (rol !== 'admin' && rol !== 'ventas' && rol !== 'encargado_sucursal' && rol !== 'repartidor') {
      res.status(403).json({ error: 'Permisos insuficientes para acceder a este módulo' });
      return;
    }

    req.user = { id: user.id, email: user.email, rol };
    next();
  } catch (err: any) {
    console.error('Error en middleware de autenticación:', err.message);
    res.status(500).json({ error: 'Error interno en autenticación' });
  }
};

// ------------------------------------------------------------
// GEOAPIFY HTTP CLIENT WRAPPER (to avoid dependency overhead)
// ------------------------------------------------------------
const fetchGeoapify = (url: string, method = 'GET', body?: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject({ status: res.statusCode, data: parsed });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Geoapify API request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

// ------------------------------------------------------------
// SCHEMAS DE VALIDACIÓN CON ZOD
// ------------------------------------------------------------
const reverseSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const optimizeSchema = z.object({
  depot: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  orders: z.array(
    z.object({
      id: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      priority: z.number().default(0),
      delivery_time_from: z.string().optional(),
      delivery_time_to: z.string().optional(),
    })
  ),
  returnsToDepot: z.boolean().default(true),
  stopDurationMinutes: z.number().default(10),
});

const calculateRouteSchema = z.object({
  waypoints: z.array(
    z.object({
      latitude: z.number(),
      longitude: z.number(),
    })
  ).min(2),
});

// ------------------------------------------------------------
// ENDPOINTS
// ------------------------------------------------------------

// GET /health
app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
});

// 1. GET /api/geocoding/autocomplete
app.get('/api/geocoding/autocomplete', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { text } = req.query;

  if (!text || typeof text !== 'string' || text.trim().length < 3) {
    res.status(400).json({ error: 'El parámetro "text" debe contener al menos 3 caracteres' });
    return;
  }

  try {
    // Buscar coordenadas por defecto de General Deheza o del depósito
    const { data: settings } = await supabase
      .from('business_delivery_settings')
      .select('depot_latitude, depot_longitude')
      .maybeSingle();

    const lat = settings?.depot_latitude ?? -32.7566;
    const lon = settings?.depot_longitude ?? -63.7861;

    // Construir llamada de autocompletado limitando a Argentina, con prioridad cercana a General Deheza
    const apiKey = process.env.GEOAPIFY_SERVER_API_KEY;
    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&filter=countrycode:ar&bias=proximity:${lon},${lat}&limit=5&apiKey=${apiKey}`;

    const data = await fetchGeoapify(url);
    
    // Mapear respuesta legible
    const results = (data.features || []).map((f: any) => {
      const p = f.properties;
      return {
        placeId: p.place_id,
        formattedAddress: p.formatted,
        street: p.street,
        streetNumber: p.housenumber || '',
        city: p.city || p.town || p.village || 'General Deheza',
        province: p.state || 'Córdoba',
        postalCode: p.postcode || '5923',
        country: p.country || 'Argentina',
        latitude: f.geometry.coordinates[1],
        longitude: f.geometry.coordinates[0],
      };
    });

    res.json(results);
  } catch (err: any) {
    console.error('Error en autocomplete de Geoapify:', err.data || err.message);
    res.status(502).json({ error: 'Error de respuesta del proveedor de mapas externo' });
  }
});

// 2. POST /api/geocoding/reverse
app.post('/api/geocoding/reverse', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = reverseSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Coordenadas inválidas', details: result.error.errors });
    return;
  }

  const { latitude, longitude } = result.data;
  try {
    const apiKey = process.env.GEOAPIFY_SERVER_API_KEY;
    const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${latitude}&lon=${longitude}&apiKey=${apiKey}`;

    const data = await fetchGeoapify(url);
    const p = data.features?.[0]?.properties;

    if (!p) {
      res.status(404).json({ error: 'No se encontró dirección para las coordenadas indicadas' });
      return;
    }

    res.json({
      placeId: p.place_id,
      formattedAddress: p.formatted,
      street: p.street,
      streetNumber: p.housenumber || '',
      city: p.city || p.town || p.village || 'General Deheza',
      province: p.state || 'Córdoba',
      postalCode: p.postcode || '5923',
      country: p.country || 'Argentina',
      latitude: data.features[0].geometry.coordinates[1],
      longitude: data.features[0].geometry.coordinates[0],
    });
  } catch (err: any) {
    console.error('Error en reverse geocoding de Geoapify:', err.data || err.message);
    res.status(502).json({ error: 'Error de respuesta del proveedor de mapas externo' });
  }
});

// 3. POST /api/routes/optimize
app.post('/api/routes/optimize', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = optimizeSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Datos de entrada inválidos para optimización', details: result.error.errors });
    return;
  }

  const { depot, orders, returnsToDepot, stopDurationMinutes } = result.data;

  if (orders.length === 0) {
    res.status(400).json({ error: 'Debes proporcionar al menos un pedido para planificar el recorrido' });
    return;
  }

  try {
    const apiKey = process.env.GEOAPIFY_SERVER_API_KEY;
    
    // Construir la petición al Route Planner de Geoapify
    // IMPORTANTE: En el cuerpo JSON de Geoapify, las coordenadas deben ser [longitud, latitud]
    const routePlannerPayload = {
      mode: 'drive',
      agents: [
        {
          id: 'vehicle-1',
          start_location: [depot.longitude, depot.latitude],
          end_location: returnsToDepot ? [depot.longitude, depot.latitude] : undefined,
          time_windows: [[0, 86400]], // 24 horas permitidas
        }
      ],
      actions: orders.map((o) => {
        // Mapear franja horaria a segundos si existen
        // Ej: "08:00" -> 28800 segundos desde las 00:00
        let time_windows = undefined;
        if (o.delivery_time_from && o.delivery_time_to) {
          const fromParts = o.delivery_time_from.split(':');
          const toParts = o.delivery_time_to.split(':');
          const fromSecs = Number(fromParts[0]) * 3600 + Number(fromParts[1]) * 60;
          const toSecs = Number(toParts[0]) * 3600 + Number(toParts[1]) * 60;
          time_windows = [[fromSecs, toSecs]];
        }

        return {
          id: o.id,
          location: [o.longitude, o.latitude],
          duration: stopDurationMinutes * 60, // en segundos
          priority: o.priority > 0 ? o.priority : undefined, // prioridad (alta/urgente)
          time_windows,
        };
      }),
      options: {
        type: 'balanced',
      }
    };

    const url = `https://api.geoapify.com/v1/routeplanner?apiKey=${apiKey}`;
    const data = await fetchGeoapify(url, 'POST', routePlannerPayload);

    // Mapear la respuesta de la ruta optimizada
    const route = data.features?.[0]?.properties || data.routes?.[0];
    const actions = route?.actions || [];

    // Extraer paradas de entrega en el orden optimizado
    // Las paradas tipo "start" o "end" representan el depósito, las de tipo "pickup" o "delivery" (o sin tipo start/end) son los pedidos
    const optimizedStops = actions
      .filter((a: any) => a.type !== 'start' && a.type !== 'end' && a.action_id)
      .map((a: any, index: number) => {
        return {
          orderId: a.action_id,
          stopPosition: index + 1,
          estimatedArrivalAt: a.start_time, // segundos desde el inicio
          durationFromPrevious: a.duration || 0, // duración en segundos del tramo
          distanceFromPrevious: a.distance || 0, // distancia en metros del tramo
        };
      });

    res.json({
      totalOrders: optimizedStops.length,
      totalDistanceMeters: route.distance || 0,
      totalDurationSeconds: route.duration || 0,
      stops: optimizedStops,
    });
  } catch (err: any) {
    console.error('Error en Geoapify Route Planner:', err.data || err.message);
    res.status(502).json({ error: 'Error del motor de optimización de Geoapify', details: err.data });
  }
});

// 4. POST /api/routes/calculate
app.post('/api/routes/calculate', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = calculateRouteSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Parámetros de trayecto inválidos', details: result.error.errors });
    return;
  }

  const { waypoints } = result.data;
  try {
    const apiKey = process.env.GEOAPIFY_SERVER_API_KEY;
    // La API de Routing de Geoapify espera los waypoints en formato "lat,lon" separados por "|"
    const waypointsQuery = waypoints.map(w => `${w.latitude},${w.longitude}`).join('|');
    const url = `https://api.geoapify.com/v1/routing?waypoints=${waypointsQuery}&mode=drive&apiKey=${apiKey}`;

    const data = await fetchGeoapify(url);
    
    const route = data.features?.[0];
    if (!route) {
      res.status(404).json({ error: 'No se pudo trazar la ruta de reparto' });
      return;
    }

    res.json({
      distance: route.properties.distance || 0,
      time: route.properties.time || 0,
      geojson: route, // Contiene la geometría exacta del trazado de la ruta (GeoJSON)
    });
  } catch (err: any) {
    console.error('Error al calcular trazado en Geoapify Routing:', err.data || err.message);
    res.status(502).json({ error: 'Error de respuesta del proveedor de mapas externo al calcular la geometría' });
  }
});

// 5. POST /api/routes/recalculate-pending
app.post('/api/routes/recalculate-pending', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = calculateRouteSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: 'Parámetros de recálculo inválidos', details: result.error.errors });
    return;
  }

  const { waypoints } = result.data;
  try {
    const apiKey = process.env.GEOAPIFY_SERVER_API_KEY;
    const waypointsQuery = waypoints.map(w => `${w.latitude},${w.longitude}`).join('|');
    const url = `https://api.geoapify.com/v1/routing?waypoints=${waypointsQuery}&mode=drive&apiKey=${apiKey}`;

    const data = await fetchGeoapify(url);
    const route = data.features?.[0];

    if (!route) {
      res.status(404).json({ error: 'No se pudo recalcular la ruta parcial' });
      return;
    }

    res.json({
      distance: route.properties.distance || 0,
      time: route.properties.time || 0,
      geojson: route,
    });
  } catch (err: any) {
    console.error('Error al recalcular ruta parcial en Geoapify:', err.data || err.message);
    res.status(502).json({ error: 'Error del motor de ruteo al calcular trazado parcial' });
  }
});

// Start Server if not loaded from test suite
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor seguro de ruteo corriendo en puerto ${PORT}`);
  });
}

export default app;
