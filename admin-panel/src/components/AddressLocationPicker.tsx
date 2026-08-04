import React, { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface GeocodedAddress {
  placeId: string;
  formattedAddress: string;
  street: string;
  streetNumber: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface AddressLocationPickerProps {
  initialAddress?: Partial<GeocodedAddress>;
  onAddressSelect: (address: GeocodedAddress, isManualAdjustment: boolean) => void;
  depotLatitude?: number;
  depotLongitude?: number;
  serviceRadiusMeters?: number;
}

export function AddressLocationPicker({
  initialAddress,
  onAddressSelect,
  depotLatitude = -32.7566,
  depotLongitude = -63.7861,
  serviceRadiusMeters = 8000,
}: AddressLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Form states
  const [searchInput, setSearchInput] = useState(initialAddress?.formattedAddress || '');
  const [suggestions, setSuggestions] = useState<GeocodedAddress[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  
  const [selectedAddress, setSelectedAddress] = useState<Partial<GeocodedAddress> | null>(initialAddress || null);
  const [reference, setReference] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'auto' | 'manual'>(initialAddress?.streetNumber ? 'auto' : 'manual');
  const [verified, setVerified] = useState(!!initialAddress?.latitude);
  const [radiusError, setRadiusError] = useState<string | null>(null);

  // Debounce ref
  const debounceTimeoutRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
  const mapApiKey = import.meta.env.VITE_GEOAPIFY_MAP_KEY || '';

  // Haversine distance calculator
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  };

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initialLat = selectedAddress?.latitude || depotLatitude;
    const initialLng = selectedAddress?.longitude || depotLongitude;

    // Map style URL using Geoapify Maps API osm-carto style
    const styleUrl = `https://maps.geoapify.com/v1/styles/osm-carto/style.json?apiKey=${mapApiKey}`;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: styleUrl,
      center: [initialLng, initialLat],
      zoom: selectedAddress?.latitude ? 16 : 14,
    });

    mapRef.current = map;

    // Create marker
    const marker = new maplibregl.Marker({
      draggable: true,
      color: '#ef4444',
    })
      .setLngLat([initialLng, initialLat])
      .addTo(map);

    markerRef.current = marker;

    // Marker drag end event handler
    marker.on('dragend', async () => {
      const lngLat = marker.getLngLat();
      const lat = lngLat.lat;
      const lng = lngLat.lng;

      // Validate radius
      const dist = calculateDistance(lat, lng, depotLatitude, depotLongitude);
      if (dist > serviceRadiusMeters) {
        setRadiusError(`Ubicación fuera del radio de cobertura (${Math.round(dist / 1000)} km de distancia). Máximo permitido: ${serviceRadiusMeters / 1000} km.`);
        return;
      } else {
        setRadiusError(null);
      }

      setLoadingSuggestions(true);
      try {
        // Retrieve session token from Supabase local storage if needed
        const supabaseSessionKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
        const token = supabaseSessionKey ? JSON.parse(localStorage.getItem(supabaseSessionKey) || '{}').access_token : '';

        // Call reverse geocoding endpoint
        const response = await fetch(`${backendUrl}/api/geocoding/reverse`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ latitude: lat, longitude: lng }),
        });

        if (response.ok) {
          const addressData: GeocodedAddress = await response.json();
          setSelectedAddress({
            ...addressData,
            latitude: lat,
            longitude: lng,
          });
          setSearchInput(addressData.formattedAddress);
          setVerificationMethod('manual');
          setVerified(true);
          onAddressSelect({ ...addressData, latitude: lat, longitude: lng }, true);
        } else {
          // If reverse geocode fails, let the user input manually but keep coords
          console.warn('Reverse geocoding failed, keeping adjusted coordinates');
        }
      } catch (err) {
        console.error('Error dragging marker reverse geocode:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    });

    // Cleanup map on unmount
    return () => {
      map.remove();
    };
  }, [depotLatitude, depotLongitude, serviceRadiusMeters]);

  // Handle autocomplete search inputs
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (val.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);

    debounceTimeoutRef.current = setTimeout(async () => {
      abortControllerRef.current = new AbortController();
      try {
        const supabaseSessionKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
        const token = supabaseSessionKey ? JSON.parse(localStorage.getItem(supabaseSessionKey) || '{}').access_token : '';

        const response = await fetch(`${backendUrl}/api/geocoding/autocomplete?text=${encodeURIComponent(val)}`, {
          signal: abortControllerRef.current.signal,
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error fetching autocomplete:', err);
        }
      } finally {
        setLoadingSuggestions(false);
      }
    }, 350);
  };

  // Handle autocomplete suggestion select
  const selectSuggestion = (addr: GeocodedAddress) => {
    // Validate radius
    const dist = calculateDistance(addr.latitude, addr.longitude, depotLatitude, depotLongitude);
    if (dist > serviceRadiusMeters) {
      setRadiusError(`La dirección seleccionada está fuera del radio de cobertura (${Math.round(dist / 1000)} km).`);
      setSuggestions([]);
      return;
    } else {
      setRadiusError(null);
    }

    setSelectedAddress(addr);
    setSearchInput(addr.formattedAddress);
    setSuggestions([]);
    setVerificationMethod('auto');
    setVerified(true);

    // Update map marker and center
    if (mapRef.current && markerRef.current) {
      mapRef.current.flyTo({
        center: [addr.longitude, addr.latitude],
        zoom: 16,
      });
      markerRef.current.setLngLat([addr.longitude, addr.latitude]);
    }

    onAddressSelect(addr, false);
  };

  // Get current device location
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('La geolocalización no está soportada por tu navegador');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Check radius limit
        const dist = calculateDistance(lat, lng, depotLatitude, depotLongitude);
        if (dist > serviceRadiusMeters) {
          setRadiusError(`Tu ubicación actual está fuera del radio de cobertura (${Math.round(dist / 1000)} km).`);
          return;
        } else {
          setRadiusError(null);
        }

        setLoadingSuggestions(true);
        try {
          const supabaseSessionKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
          const token = supabaseSessionKey ? JSON.parse(localStorage.getItem(supabaseSessionKey) || '{}').access_token : '';

          const response = await fetch(`${backendUrl}/api/geocoding/reverse`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ latitude: lat, longitude: lng }),
          });

          if (response.ok) {
            const addressData: GeocodedAddress = await response.json();
            setSelectedAddress({
              ...addressData,
              latitude: lat,
              longitude: lng,
            });
            setSearchInput(addressData.formattedAddress);
            setVerificationMethod('manual');
            setVerified(true);

            if (mapRef.current && markerRef.current) {
              mapRef.current.flyTo({ center: [lng, lat], zoom: 16 });
              markerRef.current.setLngLat([lng, lat]);
            }

            onAddressSelect({ ...addressData, latitude: lat, longitude: lng }, true);
          }
        } catch (err) {
          console.error('Error reverse geocoding current location:', err);
        } finally {
          setLoadingSuggestions(false);
        }
      },
      (err) => {
        console.error('Error getting geolocation:', err);
        alert('No se pudo obtener tu ubicación. Por favor, buscala en el buscador superior.');
      }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <label style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-primary)' }}>
          Calle, Altura y Localidad
        </label>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="input-field"
            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}
            placeholder="Ej: Bv. San Martin 123, General Deheza..."
            value={searchInput}
            onChange={handleSearchChange}
          />
          <button
            type="button"
            style={{
              padding: '10px 14px',
              backgroundColor: '#f1f5f9',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
            onClick={useCurrentLocation}
          >
            📍 Mi Ubicación
          </button>
        </div>

        {/* Suggestions dropdown */}
        {loadingSuggestions && (
          <div style={{ padding: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Buscando direcciones...</div>
        )}

        {suggestions.length > 0 && (
          <ul
            style={{
              position: 'absolute',
              top: '64px',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              boxShadow: 'var(--shadow-md)',
              zIndex: 9999,
              listStyle: 'none',
              padding: 0,
              margin: 0,
              maxHeight: '200px',
              overflowY: 'auto'
            }}
          >
            {suggestions.map((addr) => (
              <li
                key={addr.placeId}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '13px'
                }}
                onClick={() => selectSuggestion(addr)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                {addr.formattedAddress}
              </li>
            ))}
          </ul>
        )}
      </div>

      {radiusError && (
        <div style={{ color: 'var(--error-color)', fontSize: '13px', fontWeight: 'bold' }}>
          ⚠️ {radiusError}
        </div>
      )}

      {/* Mapbox/MapLibre container */}
      <div
        ref={mapContainerRef}
        style={{
          height: '240px',
          width: '100%',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}
      />

      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginTop: '-4px' }}>
        <span>© OpenStreetMap contributors · Geoapify</span>
        {verified && (
          <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>
            {verificationMethod === 'auto' ? '✔ Dirección Verificada por Catastro' : '⚠ Ubicación Ajustada Manualmente'}
          </span>
        )}
      </div>
    </div>
  );
}
