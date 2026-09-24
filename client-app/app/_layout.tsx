import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NotificationContainer } from '../components/NotificationContainer';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { PwaInstallBanner } from '../components/PwaInstallBanner';
import { QrInstallModal } from '../components/QrInstallModal';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/authStore';
import { useClientRealtimeNotifications } from '../hooks/useClientRealtimeNotifications';
import { customAlert } from '../utils/alert';
import { useFonts } from 'expo-font';
import { versionService } from '@shared/services/versionService';

export default function RootLayout() {
  useClientRealtimeNotifications();

  const [fontsLoaded, fontError] = useFonts({
    MaterialCommunityIcons: require('../assets/fonts/MaterialCommunityIcons.ttf'),
  });
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const logout = useAuthStore((state) => state.logout);
  const setSessionExpired = useAuthStore((state) => state.setSessionExpired);

  // Monitoreo de inactividad de sesión (15 minutos)
  useEffect(() => {
    if (!isLoggedIn) return;

    const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutos en ms
    let timeoutId: any;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
        setSessionExpired(true);
        customAlert(
          'Sesión Expirada',
          'Tu sesión ha expirado por inactividad. Por favor, ingresá nuevamente.'
        );
      }, INACTIVITY_TIMEOUT);
    };

    resetTimer();

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    if (Platform.OS === 'web') {
      events.forEach((event) => {
        window.addEventListener(event, resetTimer);
      });
    }

    return () => {
      clearTimeout(timeoutId);
      if (Platform.OS === 'web') {
        events.forEach((event) => {
          window.removeEventListener(event, resetTimer);
        });
      }
    };
  }, [isLoggedIn, logout, setSessionExpired]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Comprobación proactiva de versión para clientes web
    versionService.fetchVersionInfo().then((info) => {
      const CLIENT_APP_VERSION = '1.3.0';
      if (versionService.isNewerOrDifferent(info.latest_version, CLIENT_APP_VERSION)) {
        useNotificationStore.getState().showToast({
          message: `Nueva versión disponible (v${info.latest_version}). Click para actualizar.`,
          type: 'info',
          actionLabel: 'Actualizar',
          onAction: () => {
            versionService.clearCacheAndReload(info.latest_version, true);
          },
        });
      } else {
        versionService.cleanFlushParamIfMatched(CLIENT_APP_VERSION, info.latest_version);
      }
    }).catch(() => {});

    if (!('serviceWorker' in navigator)) return;

    // Registrar Service Worker y monitorear actualizaciones
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            useNotificationStore.getState().showToast({
              message: 'Nueva versión disponible. Click para actualizar.',
              type: 'info',
              actionLabel: 'Actualizar',
              onAction: () => {
                versionService.clearCacheAndReload('latest', true);
              },
            });
          }
        });
      });
    }).catch((err) => {
      console.warn('⚠️ Error al registrar PWA Service Worker:', err);
    });
  }, []);

  // Título y meta tags PWA para web (iOS Standalone sin barra)
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.title = 'Tienda QGD';

    const setFavicon = (href: string) => {
      let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.head.appendChild(link);
      }
      link.href = href;
    };

    const ensureAppleTouchIcon = (href: string) => {
      const rels = ['apple-touch-icon', 'apple-touch-icon-precomposed'];
      rels.forEach((rel) => {
        let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
        if (!link) {
          link = document.createElement('link');
          link.rel = rel;
          document.head.appendChild(link);
        }
        link.href = href;
      });
    };

    setFavicon('/logo2.png');
    ensureAppleTouchIcon('/logo2.png');

    const ensureMeta = (name: string, content: string) => {
      let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
    };

    ensureMeta('apple-mobile-web-app-capable', 'yes');
    ensureMeta('mobile-web-app-capable', 'yes');
    ensureMeta('apple-touch-fullscreen', 'yes');
    ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    ensureMeta('apple-mobile-web-app-title', 'Tienda QGD');
  }, []);

  if (!fontsLoaded && !fontError && Platform.OS !== 'web') {
    return null;
  }
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="confirmacion-pago" options={{ headerShown: false }} />
      </Stack>
      <NotificationContainer />
      <ConfirmationModal />
      <PwaInstallBanner />
      <QrInstallModal />
    </>
  );
}



