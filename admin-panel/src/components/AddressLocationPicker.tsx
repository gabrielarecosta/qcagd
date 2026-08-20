import React, { useState, useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { geocodeAddress } from '@shared/utils/geo';

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
  const [verificationMethod, setVerificationMethod] = useState<'auto' | 'manual'>(initialAddress?.streetNumber ? 'auto' : 'manual');
  const [verified, setVerified] = useState(!!initialAddress?.latitude);
  const [radiusError, setRadiusError] = useState<string | null>(null);

  // Debounce ref
  const debounceTimeoutRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.quimicagd.com.ar';

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

  // Synchronize component state if initialAddress prop updates externally
  useEffect(() => {
    if (initialAddress) {
      if (initialAddress.formattedAddress && initialAddress.formattedAddress !== searchInput) {
        setSearchInput(initialAddress.formattedAddress);
      }
      if (initialAddress.latitude && initialAddress.longitude) {
        const lat = initialAddress.latitude;
        const lng = initialAddress.longitude;
        setSelectedAddress(initialAddress);
        if (mapRef.current && markerRef.current) {
          mapRef.current.flyTo({ center: [lng, lat], zoom: 16 });
          markerRef.current.setLngLat([lng, lat]);
        }
      }
    }
  }, [initialAddress?.formattedAddress, initialAddress?.latitude, initialAddress?.longitude]);

  // Initialize MapLibre
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      const initialLat = selectedAddress?.latitude || depotLatitude;
      const initialLng = selectedAddress?.longitude || depotLongitude;

      const mapStyle: maplibregl.StyleSpecification = {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors | Química General Deheza',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      };

      if (!mapRef.current) {
        const map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: mapStyle,
          center: [initialLng, initialLat],
          zoom: selectedAddress?.latitude ? 16 : 14,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');
        mapRef.current = map;

        const marker = new maplibregl.Marker({
          draggable: true,
          color: '#ef4444',
        })
          .setLngLat([initialLng, initialLat])
          .addTo(map);

        markerRef.current = marker;

        map.on('load', () => {
          map.resize();
        });

        const processLocationChange = async (lat: number, lng: number) => {
          const dist = calculateDistance(lat, lng, depotLatitude, depotLongitude);
          if (dist > serviceRadiusMeters) {
            setRadiusError(`Ubicación fuera del radio de cobertura (${Math.round(dist / 1000)} km de distancia).`);
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
              setSelectedAddress(addressData);
              setSearchInput(addressData.formattedAddress);
              setVerificationMethod('manual');
              setVerified(true);
              onAddressSelect(addressData, true);
            }
          } catch (err) {
            console.error('Error pin location reverse geocode:', err);
          } finally {
            setLoadingSuggestions(false);
          }
        };

        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          processLocationChange(lngLat.lat, lngLat.lng);
        });

        map.on('click', (e) => {
          marker.setLngLat(e.lngLat);
          processLocationChange(e.lngLat.lat, e.lngLat.lng);
        });
      } else {
        mapRef.current.resize();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [depotLatitude, depotLongitude, serviceRadiusMeters]);


  // Execute explicit address search and map update
  const handleSearchAddress = async () => {
    if (!searchInput.trim()) return;

    setLoadingSuggestions(true);
    setRadiusError(null);

    try {
      const result = await geocodeAddress(searchInput, 'General Deheza', 'Córdoba');

      let lat = -32.7561;
      let lng = -63.7845;
      let formatted = searchInput;

      if (result) {
        lat = result.latitude;
        lng = result.longitude;
        formatted = result.formattedAddress || searchInput;
      }

      const dist = calculateDistance(lat, lng, depotLatitude, depotLongitude);
      if (dist > serviceRadiusMeters) {
        setRadiusError(`Ubicación fuera del radio de cobertura (${Math.round(dist / 1000)} km).`);
        return;
      }

      const geocoded: GeocodedAddress = {
        placeId: `search-${Date.now()}`,
        formattedAddress: formatted,
        street: result?.correctedStreet || searchInput,
        streetNumber: '',
        city: 'General Deheza',
        province: 'Córdoba',
        postalCode: 'X5923',
        country: 'Argentina',
        latitude: lat,
        longitude: lng,
      };

      setSelectedAddress(geocoded);
      setSearchInput(formatted);
      setSuggestions([]);
      setVerificationMethod('manual');
      setVerified(true);

      if (mapRef.current && markerRef.current) {
        mapRef.current.flyTo({
          center: [lng, lat],
          zoom: 16,
        });
        markerRef.current.setLngLat([lng, lat]);
      }

      onAddressSelect(geocoded, false);
    } catch (err) {
      console.error('Error buscando dirección:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

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
        alert('No se pudo obtener tu ubicación. Por favor, escribila en el buscador superior.');
      }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <label style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}>
          Escribí la dirección y tocá "Buscar Dirección" para centrar en el mapa:
        </label>
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            style={{ flex: 1, minWidth: '220px', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
            placeholder="Ej: Bv. San Martín 120, General Deheza..."
            value={searchInput}
            onChange={handleSearchChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearchAddress();
              }
            }}
          />
          <button
            type="button"
            style={{
              padding: '10px 16px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
            }}
            onClick={handleSearchAddress}
          >
            🔍 Buscar Dirección
          </button>
          <button
            type="button"
            style={{
              padding: '10px 12px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '13px'
            }}
            onClick={useCurrentLocation}
            title="Obtener ubicación por GPS"
          >
            📍 GPS
          </button>
        </div>

        {/* Suggestions dropdown */}
        {loadingSuggestions && (
          <div style={{ padding: '8px', fontSize: '13px', color: '#64748b' }}>Buscando direcciones y geolocalizando...</div>
        )}

        {suggestions.length > 0 && (
          <ul
            style={{
              position: 'absolute',
              top: '68px',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
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
                📍 {addr.formattedAddress}
              </li>
            ))}
          </ul>
        )}
      </div>

      {radiusError && (
        <div style={{ color: '#dc2626', fontSize: '13px', fontWeight: 'bold' }}>
          ⚠️ {radiusError}
        </div>
      )}

      {/* MapLibre container */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '260px',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid #cbd5e1',
          position: 'relative'
        }}
      />
      <span style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
        👉 Podés hacer clic en cualquier parte del mapa o arrastrar el pin rojo para ajustar el domicilio exacto.
      </span>

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
