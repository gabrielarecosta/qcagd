import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [showIosModal, setShowIosModal] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // 1. Verificar si la app ya se ejecuta como standalone / instalada
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIosStandalone = (window.navigator as any).standalone === true;
      const isAndroidApp = document.referrer.includes('android-app://');
      return isStandaloneMedia || isIosStandalone || isAndroidApp;
    };

    if (checkStandalone()) {
      setIsInstalled(true);
      return;
    }

    // 2. Verificar si el usuario descartó el banner recientemente (7 días)
    const dismissedAt = localStorage.getItem('qgd_pwa_dismissed_at');
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // 3. Detección de iOS Safari
    const ua = window.navigator.userAgent;
    const isIosDevice = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    if (isIosDevice) {
      // En iOS mostramos el banner para explicar el proceso de "Agregar a inicio"
      setShowBanner(true);
    }

    // 4. Capturar el evento beforeinstallprompt (Android Chrome / Edge / Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Escuchar cuando se completa la instalación
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowBanner(false);
      setShowIosModal(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = () => {
    if (isIos) {
      setShowIosModal(true);
    } else if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          setShowBanner(false);
        }
        setDeferredPrompt(null);
      });
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('qgd_pwa_dismissed_at', Date.now().toString());
    }
  };

  if (isInstalled || !showBanner) {
    return null;
  }

  return (
    <>
      {/* Banner flotante inferior */}
      <View style={styles.bannerContainer}>
        <View style={styles.bannerContent}>
          <Image
            source={{ uri: '/icon-192.png' }}
            style={styles.appIcon}
            resizeMode="contain"
          />
          <View style={styles.textContainer}>
            <Text style={styles.bannerTitle}>Instalar App Móvil</Text>
            <Text style={styles.bannerSubtitle}>
              {isIos
                ? 'Accedé más rápido desde tu pantalla de inicio'
                : 'Instalá la app oficial sin usar AppStore/PlayStore'}
            </Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.installButton}
            onPress={handleInstallClick}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="download" size={18} color="#FFFFFF" />
            <Text style={styles.installButtonText}>Instalar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleDismiss}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="close" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal explicativo paso a paso para iOS Safari */}
      {isIos && (
        <Modal
          visible={showIosModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowIosModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <TouchableOpacity
                style={styles.modalCloseIcon}
                onPress={() => setShowIosModal(false)}
              >
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>

              <Image
                source={{ uri: '/icon-192.png' }}
                style={styles.modalAppIcon}
                resizeMode="contain"
              />

              <Text style={styles.modalTitle}>Instalar en iPhone / iPad</Text>
              <Text style={styles.modalSubtitle}>
                Seguí estos sencillos pasos para agregar Química General Deheza a tu pantalla de inicio:
              </Text>

              <View style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>1</Text>
                </View>
                <Text style={styles.stepText}>
                  Tocá el botón <Text style={styles.boldText}>Compartir</Text>{' '}
                  <MaterialCommunityIcons name="export-variant" size={18} color="#1A56DB" /> en el menú inferior de Safari.
                </Text>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>2</Text>
                </View>
                <Text style={styles.stepText}>
                  Desplazate hacia abajo y seleccioná{' '}
                  <Text style={styles.boldText}>"Agregar a inicio"</Text>{' '}
                  <MaterialCommunityIcons name="plus-box-outline" size={18} color="#1A56DB" />.
                </Text>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>3</Text>
                </View>
                <Text style={styles.stepText}>
                  Presioná <Text style={styles.boldText}>"Agregar"</Text> arriba a la derecha. ¡Listo!
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalUnderstandButton}
                onPress={() => {
                  setShowIosModal(false);
                  handleDismiss();
                }}
              >
                <Text style={styles.modalUnderstandText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#334155',
    zIndex: 9999,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  appIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  bannerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  installButton: {
    backgroundColor: '#1A56DB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  installButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeButton: {
    padding: 6,
  },
  // Modal iOS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  modalCloseIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  modalAppIcon: {
    width: 60,
    height: 60,
    borderRadius: 14,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1A56DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  stepText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  modalUnderstandButton: {
    marginTop: 10,
    backgroundColor: '#1A56DB',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalUnderstandText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
