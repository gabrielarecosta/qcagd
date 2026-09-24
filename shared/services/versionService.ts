import { VersionInfo, VersionHistoryItem } from '../types/version';
export type { VersionInfo, VersionHistoryItem };

const ATTEMPT_STORAGE_KEY = 'version_update_attempt';
const MAX_RELOAD_ATTEMPTS = 2;
const ATTEMPT_COOLDOWN_MS = 60000; // 1 minuto de enfriamiento contra bucles

export const versionService = {
  /**
   * Compara dos versiones semánticas (ej. "1.3.0" vs "1.2.0").
   * Retorna > 0 si v1 > v2, < 0 si v1 < v2, y 0 si son iguales.
   */
  compareVersions(v1: string, v2: string): number {
    const cleanV1 = (v1 || '').replace(/^v/i, '').trim();
    const cleanV2 = (v2 || '').replace(/^v/i, '').trim();

    if (cleanV1 === cleanV2) return 0;

    const parts1 = cleanV1.split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = cleanV2.split('.').map(n => parseInt(n, 10) || 0);
    const maxLen = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLen; i++) {
      const p1 = parts1[i] ?? 0;
      const p2 = parts2[i] ?? 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }

    return 0;
  },

  /**
   * Determina si la versión de la API es superior o distinta a la local.
   */
  isNewerOrDifferent(latestVersion: string, currentVersion: string): boolean {
    const cleanLatest = (latestVersion || '').replace(/^v/i, '').trim();
    const cleanCurrent = (currentVersion || '').replace(/^v/i, '').trim();

    if (!cleanLatest || !cleanCurrent) return false;
    return cleanLatest !== cleanCurrent;
  },

  /**
   * Consume el endpoint de versión.
   * Prioriza el backend `/api/version` y cuenta con fallback a `/version.json` estático.
   */
  async fetchVersionInfo(backendUrl = 'https://api.quimicagd.com.ar'): Promise<VersionInfo> {
    const timestamp = Date.now();
    const endpointsToTry: string[] = [];

    if (backendUrl) {
      const cleanBase = backendUrl.replace(/\/+$/, '');
      endpointsToTry.push(`${cleanBase}/api/version?_t=${timestamp}`);
    }

    // Fallback relativo para entornos web (servido en /public/version.json)
    if (typeof window !== 'undefined' && window.location) {
      endpointsToTry.push(`/version.json?_t=${timestamp}`);
    }

    for (const endpoint of endpointsToTry) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          if (data && typeof data.latest_version === 'string' && Array.isArray(data.history)) {
            return {
              latest_version: data.latest_version,
              history: data.history,
            };
          }
        }
      } catch (err) {
        // Continuar al siguiente endpoint
      }
    }

    // Fallback seguro si la red o los servidores no responden
    return {
      latest_version: '1.3.0',
      history: [
        {
          version: '1.3.0',
          fecha: '2026-09-23',
          descripcion: 'Control de versiones, ingreso numérico en carrito y corrección de lista 1 de precios.',
        },
      ],
    };
  },

  /**
   * Verifica si se puede recargar sin entrar en un bucle infinito.
   */
  canAttemptReload(targetVersion: string): boolean {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;

    try {
      const stored = sessionStorage.getItem(ATTEMPT_STORAGE_KEY);
      if (!stored) return true;

      const record = JSON.parse(stored);
      if (record.targetVersion === targetVersion) {
        const elapsed = Date.now() - (record.timestamp || 0);
        if (record.attempts >= MAX_RELOAD_ATTEMPTS && elapsed < ATTEMPT_COOLDOWN_MS) {
          return false;
        }
      }
      return true;
    } catch {
      return true;
    }
  },

  /**
   * Ejecuta la limpieza de caché, desregistro de Service Workers y recarga forzada.
   */
  async clearCacheAndReload(targetVersion: string, force = false): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // Control anti-bucle infinito usando sessionStorage
    if (!force && !this.canAttemptReload(targetVersion)) {
      console.warn(
        `[VersionService] Se evitó recarga automática para versión ${targetVersion} por límite de intentos en sesión.`
      );
      return false;
    }

    try {
      const stored = sessionStorage.getItem(ATTEMPT_STORAGE_KEY);
      let currentAttempts = 0;
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.targetVersion === targetVersion) {
            currentAttempts = parsed.attempts || 0;
          }
        } catch {}
      }

      sessionStorage.setItem(
        ATTEMPT_STORAGE_KEY,
        JSON.stringify({
          targetVersion,
          attempts: currentAttempts + 1,
          timestamp: Date.now(),
        })
      );
    } catch {}

    // a) Limpiar Cache Storage API ('caches' in window)
    if ('caches' in window) {
      try {
        const cacheNames = await window.caches.keys();
        await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
        console.log('[VersionService] Cache Storage limpiado exitosamente.');
      } catch (err) {
        console.warn('[VersionService] Error al limpiar Cache Storage:', err);
      }
    }

    // b) Desregistrar Service Workers si existen
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
        console.log('[VersionService] Service Workers desregistrados.');
      } catch (err) {
        console.warn('[VersionService] Error al desregistrar Service Workers:', err);
      }
    }

    // c) Forzar una recarga limpia evitando el cache de disco usando query param v_flush
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('v_flush', Date.now().toString());
      window.location.replace(currentUrl.toString());
      return true;
    } catch (err) {
      window.location.reload();
      return true;
    }
  },

  /**
   * Si la versión local ya coincide con la de la API, limpia los intentos y quita el param ?v_flush de la URL.
   */
  cleanFlushParamIfMatched(currentVersion: string, latestVersion: string): void {
    if (typeof window === 'undefined') return;

    const cleanCurrent = (currentVersion || '').replace(/^v/i, '').trim();
    const cleanLatest = (latestVersion || '').replace(/^v/i, '').trim();

    if (cleanCurrent === cleanLatest) {
      try {
        sessionStorage.removeItem(ATTEMPT_STORAGE_KEY);
      } catch {}

      try {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has('v_flush')) {
          currentUrl.searchParams.delete('v_flush');
          window.history.replaceState({}, document.title, currentUrl.pathname + currentUrl.search + currentUrl.hash);
        }
      } catch {}
    }
  },
};
