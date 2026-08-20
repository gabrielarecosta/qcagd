import type { Coordinate, DeliveryZone } from '../types/zone';

/**
 * Algoritmo Ray Casting (Point in Polygon)
 * Determina si una coordenada [lng, lat] se encuentra dentro de un polígono de vértices.
 * @param point [longitude, latitude]
 * @param polygon Array de coordenadas [longitude, latitude]
 */
export function isPointInsidePolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  if (!polygon || polygon.length < 3) return false;

  const [x, y] = point; // x = lng, y = lat
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Busca la zona de reparto correspondiente para una coordenada dada.
 */
export function findZoneForCoordinates(
  lat: number,
  lng: number,
  zones: DeliveryZone[]
): DeliveryZone | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return null;
  }

  const point: Coordinate = [lng, lat];

  for (const zone of zones) {
    if (zone.active === false || zone.activo === false) continue;
    if (zone.polygon && Array.isArray(zone.polygon) && zone.polygon.length >= 3) {
      if (isPointInsidePolygon(point, zone.polygon)) {
        return zone;
      }
    }
  }

  return null;
}

/**
 * Calcula la distancia en kilómetros entre dos coordenadas usando la fórmula de Haversine.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export interface RouteStopInput {
  orderId: string;
  latitude: number;
  longitude: number;
  [key: string]: any;
}

export interface OptimizedRouteResult {
  orderedStops: Array<RouteStopInput & { stopOrder: number; distanceToPrevKm: number }>;
  totalDistanceKm: number;
  estimatedDurationMinutes: number;
}

/**
 * Heurística Nearest Neighbor (Vecino Más Cercano) para resolver TSP (Travelling Salesperson Problem)
 * Ordena las paradas de entrega partiendo del depósito central.
 */
export function optimizeRouteStops(
  depot: { latitude: number; longitude: number },
  stops: RouteStopInput[],
  stopDurationMinutes: number = 8,
  averageSpeedKmH: number = 30
): OptimizedRouteResult {
  if (!stops || stops.length === 0) {
    return {
      orderedStops: [],
      totalDistanceKm: 0,
      estimatedDurationMinutes: 0,
    };
  }

  const unvisited = [...stops];
  const orderedStops: Array<RouteStopInput & { stopOrder: number; distanceToPrevKm: number }> = [];

  let currentLat = depot.latitude;
  let currentLon = depot.longitude;
  let totalDistanceKm = 0;

  let orderCounter = 1;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const stop = unvisited[i];
      const dist = calculateDistanceKm(currentLat, currentLon, stop.latitude, stop.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    const nextStop = unvisited.splice(nearestIndex, 1)[0];
    totalDistanceKm += minDistance;

    orderedStops.push({
      ...nextStop,
      stopOrder: orderCounter++,
      distanceToPrevKm: Number(minDistance.toFixed(2)),
    });

    currentLat = nextStop.latitude;
    currentLon = nextStop.longitude;
  }

  // Tiempo de viaje = (distancia / velocidad) * 60 + tiempo por parada
  const travelTimeMinutes = (totalDistanceKm / averageSpeedKmH) * 60;
  const serviceTimeMinutes = stops.length * stopDurationMinutes;
  const estimatedDurationMinutes = Math.round(travelTimeMinutes + serviceTimeMinutes);

  return {
    orderedStops,
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    estimatedDurationMinutes,
  };
}

import { suggestDehezaStreets } from './dehezaStreets';

/**
 * Geocodifica una dirección hacia coordenadas [latitude, longitude]
 * Con sugerencias y corrección ortográfica de calles de General Deheza, Córdoba.
 */
export async function geocodeAddress(
  address: string,
  city: string = 'General Deheza',
  province: string = 'Córdoba'
): Promise<{ latitude: number; longitude: number; formattedAddress: string; correctedStreet?: string } | null> {
  const cleanAddress = address.trim();
  if (!cleanAddress) return null;

  // 1. Analizar sugerencia con Fuzzy Matching de General Deheza
  const dehezaSuggestions = suggestDehezaStreets(cleanAddress, 1);
  const bestMatch = dehezaSuggestions.length > 0 ? dehezaSuggestions[0] : null;

  // Si la dirección ya contiene la localidad/provincia, no duplicarla en la búsqueda
  const hasCityInText = cleanAddress.toLowerCase().includes('deheza') || cleanAddress.toLowerCase().includes('córdoba') || cleanAddress.toLowerCase().includes('cordoba');

  const addressToSearch = (bestMatch && bestMatch.score >= 0.5)
    ? bestMatch.fullAddress
    : hasCityInText
    ? cleanAddress
    : `${cleanAddress}, ${city}, ${province}, Argentina`;

  const canonicalFormattedAddress = (bestMatch && bestMatch.score >= 0.4)
    ? bestMatch.fullAddress
    : hasCityInText
    ? cleanAddress
    : `${cleanAddress}, ${city}, ${province}`;

  try {
    // 2. Intentar con Nominatim / OpenStreetMap
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressToSearch)}&limit=1&countrycodes=ar`;
    const res = await fetch(osmUrl, {
      headers: {
        'User-Agent': 'QuimicaGeneralDeheza-DeliverySystem/1.0',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
          formattedAddress: canonicalFormattedAddress,
          correctedStreet: bestMatch?.street.name,
        };
      }
    }
  } catch (err) {
    console.warn('OSM Geocoding warning:', err);
  }

  // 3. Si falló la consulta externa pero tenemos la calle oficial de General Deheza
  if (bestMatch && (city.toLowerCase().includes('general deheza') || address.toLowerCase().includes('deheza') || bestMatch.score >= 0.4)) {
    return {
      latitude: bestMatch.latitude,
      longitude: bestMatch.longitude,
      formattedAddress: bestMatch.fullAddress,
      correctedStreet: bestMatch.street.name,
    };
  }

  // 4. Coordenadas de referencia urbana por defecto
  if (hasCityInText || city.toLowerCase().includes('general deheza')) {
    return {
      latitude: -32.7561,
      longitude: -63.7845,
      formattedAddress: canonicalFormattedAddress,
    };
  }

  return null;
}
