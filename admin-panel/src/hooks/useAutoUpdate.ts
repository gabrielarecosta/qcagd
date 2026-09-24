import { useState, useEffect, useCallback, useRef } from 'react';
import { versionService, VersionHistoryItem } from '@shared/services';
import { APP_VERSION } from '../config/version';

const THROTTLE_FOCUS_CHECK_MS = 60000; // 60 segundos entre chequeos por foco

export function useAutoUpdate() {
  const [currentVersion] = useState<string>(APP_VERSION);
  const [latestVersion, setLatestVersion] = useState<string>(APP_VERSION);
  const [history, setHistory] = useState<VersionHistoryItem[]>([]);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const [blockedByLoopProtection, setBlockedByLoopProtection] = useState<boolean>(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const lastCheckTimestampRef = useRef<number>(0);
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://api.quimicagd.com.ar';

  const checkVersion = useCallback(async (isUserInitiated = false) => {
    setIsChecking(true);
    lastCheckTimestampRef.current = Date.now();

    try {
      const data = await versionService.fetchVersionInfo(backendUrl);
      setLatestVersion(data.latest_version);
      setHistory(data.history);
      setLastChecked(new Date());

      const needsUpdate = versionService.isNewerOrDifferent(data.latest_version, currentVersion);
      setHasUpdate(needsUpdate);

      if (needsUpdate) {
        console.log(
          `[AutoUpdate] Detectada nueva versión: ${data.latest_version} (Actual en cliente: ${currentVersion})`
        );

        // Si es chequeo automático, verificar protección contra bucle
        const reloaded = await versionService.clearCacheAndReload(data.latest_version, isUserInitiated);
        if (!reloaded) {
          setBlockedByLoopProtection(true);
        } else {
          setIsReloading(true);
        }
      } else {
        // La versión está al día: limpiar param ?v_flush de la URL y remover intentos anteriores
        versionService.cleanFlushParamIfMatched(currentVersion, data.latest_version);
        setBlockedByLoopProtection(false);
      }
    } catch (err) {
      console.warn('[AutoUpdate] Error al verificar versión:', err);
    } finally {
      setIsChecking(false);
    }
  }, [backendUrl, currentVersion]);

  // Forzar actualización manual (ignora el límite de reintentos)
  const forceUpdateNow = useCallback(async () => {
    setIsReloading(true);
    await versionService.clearCacheAndReload(latestVersion, true);
  }, [latestVersion]);

  // Efecto de montaje inicial y eventos de ventana (focus y visibilitychange)
  useEffect(() => {
    // 1. Verificación al montar la app
    checkVersion(false);

    // 2. Verificación al reenfocar la ventana
    const handleFocusOrVisible = () => {
      const now = Date.now();
      if (now - lastCheckTimestampRef.current > THROTTLE_FOCUS_CHECK_MS) {
        checkVersion(false);
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleFocusOrVisible();
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
    };
  }, [checkVersion]);

  return {
    currentVersion,
    latestVersion,
    history,
    isChecking,
    hasUpdate,
    isReloading,
    blockedByLoopProtection,
    lastChecked,
    checkVersion: () => checkVersion(true),
    forceUpdateNow,
  };
}
