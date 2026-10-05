import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  Image,
} from 'react-native';

// Helper global para gatillar el modal de instalación desde cualquier componente
export const triggerPwaInstallModal = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-pwa-install-modal'));
  }
};

export interface BrowserDetails {
  isStandalone: boolean;
  isIos: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isInAppBrowser: boolean;
  inAppName: string;
  browserType: 'ios_safari' | 'ios_chrome' | 'ios_other' | 'android_chrome' | 'android_firefox' | 'android_samsung' | 'android_other' | 'desktop' | 'in_app';
  browserLabel: string;
}

export const getBrowserDetails = (): BrowserDetails => {
  if (typeof window === 'undefined' || Platform.OS !== 'web') {
    return {
      isStandalone: false,
      isIos: false,
      isAndroid: false,
      isDesktop: true,
      isInAppBrowser: false,
      inAppName: '',
      browserType: 'desktop',
      browserLabel: 'Navegador Web',
    };
  }

  const ua = window.navigator.userAgent || '';

  // 1. Modo Standalone (ya instalado y abierto como PWA)
  const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = (window.navigator as any).standalone === true;
  const isAndroidApp = document.referrer.includes('android-app://');
  const isStandalone = isStandaloneMedia || isIosStandalone || isAndroidApp;

  // 2. SO & Detección Desktop/PC
  const isIos = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
  const isAndroid = /android/i.test(ua);
  const isDesktop = (!isIos && !isAndroid) || (typeof window !== 'undefined' && window.innerWidth >= 768);

  // 3. In-App Webviews (Instagram, FB, WhatsApp, TikTok, etc.)
  let isInAppBrowser = false;
  let inAppName = '';

  if (/Instagram/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'Instagram';
  } else if (/FBAV|FBAN|FBIOS|FB4A|FB_IAB/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'Facebook';
  } else if (/WhatsApp/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'WhatsApp';
  } else if (/LinkedInApp/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'LinkedIn';
  } else if (/Snapchat/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'Snapchat';
  } else if (/Line\//i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'Line';
  } else if (/MicroMessenger/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'WeChat';
  } else if (/Twitter|TikTok/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'Red Social';
  }

  // 4. Tipo específico de Navegador
  let browserType: BrowserDetails['browserType'] = 'desktop';
  let browserLabel = 'Navegador Web';

  if (isInAppBrowser) {
    browserType = 'in_app';
    browserLabel = `Navegador Interno (${inAppName})`;
  } else if (isIos) {
    if (/crios/i.test(ua)) {
      browserType = 'ios_chrome';
      browserLabel = 'Google Chrome (iOS)';
    } else if (/fxios|optios|edgios/i.test(ua)) {
      browserType = 'ios_other';
      browserLabel = 'Navegador iOS';
    } else {
      browserType = 'ios_safari';
      browserLabel = 'Safari (iOS)';
    }
  } else if (isAndroid) {
    if (/samsungbrowser/i.test(ua)) {
      browserType = 'android_samsung';
      browserLabel = 'Samsung Internet';
    } else if (/firefox/i.test(ua)) {
      browserType = 'android_firefox';
      browserLabel = 'Firefox Android';
    } else if (/chrome/i.test(ua)) {
      browserType = 'android_chrome';
      browserLabel = 'Google Chrome';
    } else {
      browserType = 'android_other';
      browserLabel = 'Navegador Android';
    }
  } else {
    browserType = 'desktop';
    browserLabel = 'Computadora / Desktop';
  }

  return {
    isStandalone,
    isIos,
    isAndroid,
    isDesktop,
    isInAppBrowser,
    inAppName,
    browserType,
    browserLabel,
  };
};

export const PwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [browserDetails, setBrowserDetails] = useState<BrowserDetails | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const initDetection = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const details = getBrowserDetails();
    setBrowserDetails(details);

    if (details.isStandalone) {
      return;
    }

    // 1. Quitar el cartel de PC / Desktop: nunca mostrar en computadoras
    if (details.isDesktop || window.innerWidth >= 768) {
      setShowBanner(false);
      return;
    }

    // 2. Verificar decisión guardada en LocalStorage: no mostrar si el usuario ya decidió (no quiere o ya instaló)
    const decision = localStorage.getItem('qgd_pwa_decision');
    if (decision === 'dismissed' || decision === 'installed' || localStorage.getItem('qgd_pwa_installed') === 'true') {
      setShowBanner(false);
      return;
    }

    setShowBanner(true);
  }, []);

  useEffect(() => {
    initDetection();

    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Escuchar evento de prompt nativo de PWA
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);

      // Si está en PC o ya tomó una decisión, NO mostrar el cartel
      const details = getBrowserDetails();
      const isDesktopOrTablet = details.isDesktop || window.innerWidth >= 768;
      const decision = localStorage.getItem('qgd_pwa_decision');
      if (!isDesktopOrTablet && !decision && localStorage.getItem('qgd_pwa_installed') !== 'true') {
        setShowBanner(true);
      }
    };

    // Escuchar evento de app instalada
    const handleAppInstalled = () => {
      setShowBanner(false);
      setShowGuideModal(false);
      setDeferredPrompt(null);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('qgd_pwa_decision', 'installed');
        localStorage.setItem('qgd_pwa_installed', 'true');
      }
    };

    // Escuchar evento global disparado manualmente desde la app
    const handleCustomOpenModal = () => {
      setShowGuideModal(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('open-pwa-install-modal', handleCustomOpenModal);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('open-pwa-install-modal', handleCustomOpenModal);
    };
  }, [initDetection]);

  const handleInstallClick = () => {
    // Si tenemos el prompt nativo (1-click install en Android)
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('qgd_pwa_decision', 'installed');
            localStorage.setItem('qgd_pwa_installed', 'true');
          }
          setShowBanner(false);
          setShowGuideModal(false);
        } else {
          // El usuario canceló la instalación
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('qgd_pwa_decision', 'dismissed');
          }
          setShowBanner(false);
          setShowGuideModal(false);
        }
        setDeferredPrompt(null);
      });
    } else {
      // Abrir modal de instrucciones adaptado al navegador
      setShowGuideModal(true);
    }
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('qgd_pwa_decision', 'dismissed');
      localStorage.setItem('qgd_pwa_dismissed_at', Date.now().toString());
    }
  };

  const handleCloseGuideModal = () => {
    setShowGuideModal(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('qgd_pwa_decision', 'dismissed');
    }
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.origin || window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      }).catch(() => {
        fallbackCopyText(url);
      });
    } else {
      fallbackCopyText(url);
    }
  };

  const fallbackCopyText = (text: string) => {
    try {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (_) {}
  };

  // Si está en desktop/PC o en modo standalone, no renderizar nada
  if (!browserDetails || browserDetails.isStandalone || browserDetails.isDesktop) {
    return null;
  }

  const { browserType, isInAppBrowser, inAppName, browserLabel } = browserDetails;

  return (
    <>
      {/* Banner flotante inferior (solo móviles) */}
      {showBanner && (
        <View style={styles.bannerContainer}>
          <View style={styles.bannerContent}>
            <Image
              source={{ uri: '/icon-192.png' }}
              style={styles.appIcon}
              resizeMode="contain"
            />
            <View style={styles.textContainer}>
              <View style={styles.badgeRow}>
                <Text style={styles.bannerTitle}>Instalar App Móvil</Text>
                <View style={styles.browserTag}>
                  <Text style={styles.browserTagText}>{browserLabel}</Text>
                </View>
              </View>
              <Text style={styles.bannerSubtitle} numberOfLines={1}>
                {deferredPrompt
                  ? '⚡ Instalá en 1-click sin entrar al AppStore'
                  : isInAppBrowser
                  ? 'Abrí en Chrome/Safari para instalar la app'
                  : 'Accedé más rápido desde tu pantalla de inicio'}
              </Text>
            </View>
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.installButton}
              onPress={handleInstallClick}
              activeOpacity={0.8}
            >
              <Text style={styles.installButtonText}>
                {deferredPrompt ? 'Instalar' : 'Ver cómo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleDismissBanner}
              activeOpacity={0.7}
              accessibilityLabel="Cerrar"
            >
              <Text style={styles.closeButtonLetter}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modal interactivo de instalación guiada */}
      <Modal
        visible={showGuideModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseGuideModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseIcon}
              onPress={handleCloseGuideModal}
              accessibilityLabel="Cerrar modal"
            >
              <Text style={styles.modalCloseLetter}>✕</Text>
            </TouchableOpacity>

            <Image
              source={{ uri: '/icon-192.png' }}
              style={styles.modalAppIcon}
              resizeMode="contain"
            />

            <Text style={styles.modalTitle}>Instalar Tienda QGD</Text>

            <View style={styles.modalBrowserBadge}>
              <Text style={{ fontSize: 13, marginRight: 4 }}>📱</Text>
              <Text style={styles.modalBrowserBadgeText}>{browserLabel}</Text>
            </View>

            {/* CASO 1: In-App Browser (WhatsApp, Instagram, Facebook, etc.) */}
            {isInAppBrowser && (
              <View style={styles.guideContainer}>
                <View style={styles.warningBox}>
                  <Text style={{ fontSize: 16, marginRight: 6 }}>⚠️</Text>
                  <Text style={styles.warningText}>
                    Estás navegando dentro de <Text style={styles.boldText}>{inAppName}</Text>. Los navegadores internos de redes sociales impiden la instalación directa.
                  </Text>
                </View>

                <Text style={styles.sectionHeaderTitle}>Pasos sencillos para instalar:</Text>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Tocá el menú de <Text style={styles.boldText}>tres puntos ⋮</Text> o el botón <Text style={styles.boldText}>Compartir</Text> arriba a la derecha.
                  </Text>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Seleccioná <Text style={styles.boldText}>"Abrir en Chrome"</Text> o <Text style={styles.boldText}>"Abrir en Safari"</Text>.
                  </Text>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>3</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Una vez abierto en tu navegador, presioná <Text style={styles.boldText}>"Instalar"</Text>.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.copyLinkButton}
                  onPress={handleCopyLink}
                  activeOpacity={0.8}
                >
                  <Text style={styles.copyLinkButtonText}>
                    {copiedLink ? '✓ ¡Enlace copiado!' : '📋 Copiar enlace de la App'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* CASO 2: iOS Chrome */}
            {browserType === 'ios_chrome' && (
              <View style={styles.guideContainer}>
                <Text style={styles.sectionHeaderTitle}>Instalar desde Google Chrome en iPhone/iPad:</Text>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Tocá el botón <Text style={styles.boldText}>Compartir [↗]</Text> arriba a la derecha (junto a la dirección web).
                  </Text>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Desplazate hacia abajo y elegí <Text style={styles.boldText}>"Agregar a la pantalla de inicio" [+]</Text>.
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
              </View>
            )}

            {/* CASO 3: iOS Safari */}
            {browserType === 'ios_safari' && (
              <View style={styles.guideContainer}>
                <Text style={styles.sectionHeaderTitle}>Instalar desde Safari en iPhone/iPad:</Text>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Tocá el botón <Text style={styles.boldText}>Compartir [↗]</Text> en el menú inferior central de Safari.
                  </Text>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Desplazate hacia abajo y seleccioná <Text style={styles.boldText}>"Agregar a inicio" [+]</Text>.
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
              </View>
            )}

            {/* CASO 4: iOS Otros (Firefox / Opera / Edge en iOS) */}
            {browserType === 'ios_other' && (
              <View style={styles.guideContainer}>
                <Text style={styles.sectionHeaderTitle}>Instalar en iPhone / iPad:</Text>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Tocá el menú de tu navegador o el icono <Text style={styles.boldText}>Compartir [↗]</Text>.
                  </Text>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Seleccioná <Text style={styles.boldText}>"Agregar a pantalla de inicio" [+]</Text> o abrilo en Safari / Chrome.
                  </Text>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>3</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Presioná <Text style={styles.boldText}>"Agregar"</Text>.
                  </Text>
                </View>
              </View>
            )}

            {/* CASO 5: Android Chrome / Samsung / Edge con 1-click prompt nativo activo */}
            {deferredPrompt && (
              <View style={styles.guideContainer}>
                <Text style={styles.sectionHeaderTitle}>¡Instalación directa lista!</Text>
                <Text style={styles.modalSubtitle}>
                  Tu navegador permite instalar la app oficial en 1 solo clic sin pasar por tienda de aplicaciones.
                </Text>

                <TouchableOpacity
                  style={styles.directInstallBtn}
                  onPress={handleInstallClick}
                  activeOpacity={0.8}
                >
                  <Text style={styles.directInstallBtnText}>📥 Instalar App Ahora</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* CASO 6: Android sin prompt nativo directo */}
            {!deferredPrompt && !isInAppBrowser && (
              <View style={styles.guideContainer}>
                <Text style={styles.sectionHeaderTitle}>Instalar desde el menú del navegador:</Text>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Tocá el menú de <Text style={styles.boldText}>tres puntos ⋮</Text> en tu navegador.
                  </Text>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Seleccioná <Text style={styles.boldText}>"Instalar aplicación"</Text> o <Text style={styles.boldText}>"Agregar a la pantalla principal" [+]</Text>.
                  </Text>
                </View>

                <View style={styles.stepItem}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>3</Text>
                  </View>
                  <Text style={styles.stepText}>
                    Presioná <Text style={styles.boldText}>"Instalar"</Text> o <Text style={styles.boldText}>"Agregar"</Text>.
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalUnderstandButton}
              onPress={handleCloseGuideModal}
            >
              <Text style={styles.modalUnderstandText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#0F172A',
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
    zIndex: 99999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  appIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  browserTag: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  browserTagText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  bannerSubtitle: {
    color: '#94A3B8',
    fontSize: 11.5,
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
    justifyContent: 'center',
  },
  installButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonLetter: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
    paddingHorizontal: 4,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 400,
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
    top: 14,
    right: 14,
    padding: 6,
    zIndex: 10,
    borderRadius: 8,
  },
  modalCloseLetter: {
    color: '#64748B',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  modalAppIcon: {
    width: 60,
    height: 60,
    borderRadius: 14,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalBrowserBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  modalBrowserBadgeText: {
    color: '#1A56DB',
    fontSize: 12,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  guideContainer: {
    width: '100%',
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  warningBox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    lineHeight: 17,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1A56DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  stepText: {
    fontSize: 12.5,
    color: '#334155',
    flex: 1,
    lineHeight: 17,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  copyLinkButton: {
    marginTop: 6,
    backgroundColor: '#059669',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  copyLinkButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13.5,
  },
  directInstallBtn: {
    backgroundColor: '#1D4ED8',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  directInstallBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  modalUnderstandButton: {
    marginTop: 8,
    backgroundColor: '#1A56DB',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalUnderstandText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
