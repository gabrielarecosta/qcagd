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
import { getBrowserDetails, BrowserDetails } from './PwaInstallBanner';

export const QrInstallModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [browserDetails, setBrowserDetails] = useState<BrowserDetails | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    // Detectar si el usuario ingresó escaneando el QR físico con source=qr_tienda
    const urlParams = new URLSearchParams(window.location.search);
    const isQrSource = urlParams.get('source') === 'qr_tienda';

    if (!isQrSource) {
      return;
    }

    const details = getBrowserDetails();
    setBrowserDetails(details);

    // 4. Si el usuario ya tiene la PWA instalada, entrar directo sin mostrar nada
    if (details.isStandalone) {
      return;
    }

    // Abrir el flujo prioritario de bienvenida/instalación
    setIsOpen(true);

    // Capturar el evento de prompt nativo de Android / Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setIsOpen(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setIsOpen(false);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('Error en prompt de instalación:', err);
        setIsOpen(false);
      }
    } else {
      setIsOpen(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    const cleanUrl = 'https://quimicagd.com.ar/?source=qr_tienda';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(cleanUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      });
    }
  };

  const handleContinueWeb = () => {
    setIsOpen(false);
  };

  if (!isOpen || !browserDetails || browserDetails.isStandalone) {
    return null;
  }

  const { isIos, isInAppBrowser, inAppName } = browserDetails;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleContinueWeb}>
      <View style={styles.fullscreenOverlay}>
        <View style={styles.containerCard}>
          {/* Header con Logo */}
          <View style={styles.headerBox}>
            <Image
              source={require('../assets/logo2.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.brandTitle}>Química General Deheza</Text>
            <View style={styles.qrBadge}>
              <MaterialCommunityIcons name="qrcode-scan" size={14} color="#0EA5E9" />
              <Text style={styles.qrBadgeText}>Acceso desde QR Tienda</Text>
            </View>
          </View>

          {/* CASO 1: In-App Browser / WebView (Instagram, WhatsApp, FB, TikTok, etc.) */}
          {isInAppBrowser ? (
            <View style={styles.contentSection}>
              <View style={styles.warningBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#D97706" />
                <Text style={styles.warningText}>
                  Estás navegando en <Text style={styles.boldText}>{inAppName || 'redes sociales'}</Text>. Los navegadores internos impiden la instalación directa.
                </Text>
              </View>

              <Text style={styles.stepHeader}>Para instalar la App en tu celular:</Text>

              <View style={styles.stepItem}>
                <View style={styles.stepBadge}><Text style={styles.stepNumber}>1</Text></View>
                <Text style={styles.stepText}>
                  Tocá los <Text style={styles.boldText}>3 puntos (⋮)</Text> o <Text style={styles.boldText}>Compartir</Text> arriba a la derecha.
                </Text>
              </View>

              <View style={styles.stepItem}>
                <View style={styles.stepBadge}><Text style={styles.stepNumber}>2</Text></View>
                <Text style={styles.stepText}>
                  Elegí <Text style={styles.boldText}>"Abrir en Chrome"</Text> o <Text style={styles.boldText}>"Abrir en Safari"</Text>.
                </Text>
              </View>

              <TouchableOpacity style={styles.copyBtn} onPress={handleCopyLink} activeOpacity={0.85}>
                <MaterialCommunityIcons name={copiedLink ? "check-circle" : "content-copy"} size={18} color="#FFFFFF" />
                <Text style={styles.copyBtnText}>{copiedLink ? '¡Enlace copiado!' : 'Copiar enlace para abrir en Chrome'}</Text>
              </TouchableOpacity>
            </View>
          ) : isIos ? (
            /* CASO 2: iPhone / iPad (iOS Safari o iOS Chrome) */
            <View style={styles.contentSection}>
              <Text style={styles.welcomeTitle}>¡Instalá la App en tu iPhone!</Text>
              <Text style={styles.welcomeSubtitle}>Accedé más rápido y realizá tu pedido sin depender del navegador.</Text>

              <View style={styles.stepsContainer}>
                <View style={styles.iosStepCard}>
                  <View style={styles.iosStepHeader}>
                    <View style={styles.stepBadge}><Text style={styles.stepNumber}>1</Text></View>
                    <Text style={styles.iosStepTitle}>Paso 1</Text>
                  </View>
                  <Text style={styles.iosStepText}>
                    Tocá el botón <Text style={styles.boldText}>Compartir</Text>{' '}
                    <MaterialCommunityIcons name="export-variant" size={20} color="#0EA5E9" />{' '}
                    en la barra del navegador.
                  </Text>
                </View>

                <View style={styles.iosStepCard}>
                  <View style={styles.iosStepHeader}>
                    <View style={styles.stepBadge}><Text style={styles.stepNumber}>2</Text></View>
                    <Text style={styles.iosStepTitle}>Paso 2</Text>
                  </View>
                  <Text style={styles.iosStepText}>
                    Seleccioná <Text style={styles.boldText}>"Añadir a pantalla de inicio"</Text>{' '}
                    <MaterialCommunityIcons name="plus-box-outline" size={20} color="#0EA5E9" />.
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            /* CASO 3: Android (Chrome / Chromium) */
            <View style={styles.contentSection}>
              <Text style={styles.welcomeTitle}>¡Bienvenido a la Tienda!</Text>
              <Text style={styles.welcomeSubtitle}>
                Descargá nuestra App Oficial para realizar tus pedidos de forma simple, rápida y directa.
              </Text>

              <TouchableOpacity
                style={styles.mainInstallBtn}
                onPress={handleInstallClick}
                activeOpacity={0.88}
              >
                <MaterialCommunityIcons name="download" size={24} color="#FFFFFF" />
                <Text style={styles.mainInstallBtnText}>📲 Descargar / Instalar App</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Botón Secundario de Salida hacia la Web */}
          <TouchableOpacity
            style={styles.continueWebBtn}
            onPress={handleContinueWeb}
            activeOpacity={0.8}
          >
            <Text style={styles.continueWebBtnText}>Continuar en la web sin instalar</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  containerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 440,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 15,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: 10,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  qrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
  },
  qrBadgeText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
  contentSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 13.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  mainInstallBtn: {
    backgroundColor: '#0EA5E9',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  mainInstallBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  warningBox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
    width: '100%',
  },
  warningText: {
    fontSize: 12.5,
    color: '#92400E',
    flex: 1,
    lineHeight: 18,
  },
  stepHeader: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0EA5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumber: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  stepText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  copyBtn: {
    backgroundColor: '#0EA5E9',
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  stepsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 8,
  },
  iosStepCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: '100%',
  },
  iosStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iosStepTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  iosStepText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  continueWebBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 8,
  },
  continueWebBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#64748B',
  },
});
