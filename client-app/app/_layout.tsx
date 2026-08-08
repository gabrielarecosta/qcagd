import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NotificationContainer } from '../components/NotificationContainer';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/authStore';
import { customAlert } from '../utils/alert';
import { useFonts } from 'expo-font';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...MaterialCommunityIcons.font,
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
    if (Platform.OS !== 'web' || !('serviceWorker' in navigator)) return;

    // 1. Registrar Service Worker y monitorear actualizaciones
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      // Monitorear si hay actualizaciones listas en segundo plano
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
                window.location.reload();
              }
            });
          }
        });
      });
    }).catch((err) => {
      console.warn('⚠️ Error al registrar PWA Service Worker:', err);
    });

    // 2. Controlar instalación de la PWA
    let deferredPrompt: any = null;
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      deferredPrompt = e;

      useNotificationStore.getState().showToast({
        message: '¡Instalá la App en tu pantalla de inicio!',
        type: 'success',
        actionLabel: 'Instalar',
        onAction: () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choice: any) => {
              if (choice.outcome === 'accepted') {
                console.log('App PWA instalada con éxito.');
              }
              deferredPrompt = null;
            });
          }
        }
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);
  if (!fontsLoaded && !fontError) {
    return null;
  }
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <NotificationContainer />
      <ConfirmationModal />
    </>
  );
}


