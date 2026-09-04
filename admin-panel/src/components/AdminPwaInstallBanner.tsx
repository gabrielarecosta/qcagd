import React, { useEffect, useState, useCallback } from 'react';

export const triggerAdminPwaInstallModal = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-admin-pwa-install-modal'));
  }
};

export interface AdminBrowserDetails {
  isStandalone: boolean;
  isIos: boolean;
  isAndroid: boolean;
  isDesktop: boolean;
  isInAppBrowser: boolean;
  inAppName: string;
  browserType: 'ios_safari' | 'ios_chrome' | 'ios_other' | 'android_chrome' | 'android_firefox' | 'android_samsung' | 'android_other' | 'desktop' | 'in_app';
  browserLabel: string;
}

export const getAdminBrowserDetails = (): AdminBrowserDetails => {
  if (typeof window === 'undefined') {
    return {
      isStandalone: false,
      isIos: false,
      isAndroid: false,
      isDesktop: false,
      isInAppBrowser: false,
      inAppName: '',
      browserType: 'desktop',
      browserLabel: 'Navegador Web',
    };
  }

  const ua = window.navigator.userAgent || '';

  const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = (window.navigator as any).standalone === true;
  const isAndroidApp = document.referrer.includes('android-app://');
  const isStandalone = isStandaloneMedia || isIosStandalone || isAndroidApp;

  const isIos = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
  const isAndroid = /android/i.test(ua);
  const isDesktop = !isIos && !isAndroid;

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

  let browserType: AdminBrowserDetails['browserType'] = 'desktop';
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

export const AdminPwaInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [browserDetails, setBrowserDetails] = useState<AdminBrowserDetails | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const initDetection = useCallback(() => {
    if (typeof window === 'undefined') return;

    const details = getAdminBrowserDetails();
    setBrowserDetails(details);

    if (details.isStandalone) {
      return;
    }

    const dismissedAt = localStorage.getItem('qca_pwa_dismissed_at');
    let wasRecentlyDismissed = false;
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 3) {
        wasRecentlyDismissed = true;
      }
    }

    if (!wasRecentlyDismissed) {
      setShowBanner(true);
    }
  }, []);

  useEffect(() => {
    initDetection();

    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    const handleAppInstalled = () => {
      setShowBanner(false);
      setShowGuideModal(false);
      setDeferredPrompt(null);
      localStorage.setItem('qca_pwa_installed', 'true');
    };

    const handleCustomOpenModal = () => {
      setShowGuideModal(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('open-admin-pwa-install-modal', handleCustomOpenModal);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('open-admin-pwa-install-modal', handleCustomOpenModal);
    };
  }, [initDetection]);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          setShowBanner(false);
          setShowGuideModal(false);
        }
        setDeferredPrompt(null);
      });
    } else {
      setShowGuideModal(true);
    }
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('qca_pwa_dismissed_at', Date.now().toString());
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

  if (!browserDetails || browserDetails.isStandalone) {
    return null;
  }

  const { browserType, isInAppBrowser, inAppName, browserLabel } = browserDetails;

  return (
    <>
      {/* Banner flotante inferior */}
      {showBanner && (
        <div style={{
          position: 'fixed',
          bottom: '16px',
          left: '16px',
          right: '16px',
          maxWidth: '520px',
          margin: '0 auto',
          backgroundColor: '#0F172A',
          borderRadius: '16px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
          border: '1px solid #334155',
          zIndex: 99999,
          color: '#F8FAFC'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, marginRight: '8px' }}>
            <img
              src="/icon-192.png"
              alt="QGD CRM"
              style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'contain' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#F8FAFC' }}>Instalar CRM en Celular</span>
                <span style={{ backgroundColor: '#1E293B', color: '#38BDF8', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', border: '1px solid #475569' }}>
                  {browserLabel}
                </span>
              </div>
              <span style={{ color: '#94A3B8', fontSize: '11px', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {deferredPrompt ? '⚡ Instalá el CRM en 1-click en tu pantalla de inicio' : 'Accedé al panel sin entrar a la PC'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={handleInstallClick}
              style={{
                backgroundColor: '#1A56DB',
                color: '#FFFFFF',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '12.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>📲</span>
              <span>{deferredPrompt ? 'Instalar' : 'Ver cómo'}</span>
            </button>

            <button
              onClick={handleDismissBanner}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                fontSize: '18px',
                padding: '6px',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Modal explicativo */}
      {showGuideModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 100000
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            padding: '24px',
            width: '100%',
            maxWidth: '420px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            color: '#0F172A'
          }}>
            <button
              onClick={() => setShowGuideModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                fontSize: '20px',
                color: '#64748B',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>

            <img
              src="/icon-192.png"
              alt="QGD CRM App"
              style={{ width: '56px', height: '56px', borderRadius: '14px', marginBottom: '10px' }}
            />

            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0', textAlign: 'center' }}>
              Instalar ADMIN QGD
            </h3>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#EFF6FF',
              color: '#1A56DB',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 700,
              border: '1px solid #BFDBFE',
              marginBottom: '16px'
            }}>
              <span>📱</span>
              <span>{browserLabel}</span>
            </div>

            {/* In-App Browser */}
            {isInAppBrowser && (
              <div style={{ width: '100%' }}>
                <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '12px', padding: '12px', marginBottom: '14px', fontSize: '12px', color: '#92400E', lineHeight: '1.5' }}>
                  ⚠️ Estás navegando dentro de <strong>{inAppName}</strong>. Los navegadores internos impiden la instalación directa.
                </div>

                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '10px' }}>Pasos sencillos:</div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>1</span>
                  <span>Tocá el menú de <strong>tres puntos ⋮</strong> o el botón <strong>Compartir</strong> arriba a la derecha.</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>2</span>
                  <span>Seleccioná <strong>"Abrir en Chrome"</strong> o <strong>"Abrir en Safari"</strong>.</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '12px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>3</span>
                  <span>Presioná <strong>"Instalar"</strong> en tu navegador.</span>
                </div>

                <button
                  onClick={handleCopyLink}
                  style={{
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <span>{copiedLink ? '✓' : '📋'}</span>
                  <span>{copiedLink ? '¡Enlace copiado!' : 'Copiar enlace del CRM'}</span>
                </button>
              </div>
            )}

            {/* iOS Chrome */}
            {browserType === 'ios_chrome' && (
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '10px' }}>Instalar desde Google Chrome (iPhone/iPad):</div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>1</span>
                  <span>Tocá el botón <strong>Compartir ⎘</strong> arriba a la derecha (junto a la dirección URL).</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>2</span>
                  <span>Desplazate y elegí <strong>"Agregar a la pantalla de inicio"</strong>.</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '12px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>3</span>
                  <span>Presioná <strong>"Agregar"</strong> arriba a la derecha.</span>
                </div>
              </div>
            )}

            {/* iOS Safari */}
            {browserType === 'ios_safari' && (
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '10px' }}>Instalar desde Safari (iPhone/iPad):</div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>1</span>
                  <span>Tocá el botón <strong>Compartir ⎘</strong> en el menú inferior central de Safari.</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>2</span>
                  <span>Desplazate hacia abajo y elegí <strong>"Agregar a inicio"</strong>.</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '12px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>3</span>
                  <span>Presioná <strong>"Agregar"</strong> arriba a la derecha.</span>
                </div>
              </div>
            )}

            {/* iOS otros */}
            {browserType === 'ios_other' && (
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '10px' }}>Instalar en iPhone / iPad:</div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>1</span>
                  <span>Tocá el menú de tu navegador o el icono <strong>Compartir ⎘</strong>.</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>2</span>
                  <span>Seleccioná <strong>"Agregar a pantalla de inicio"</strong>.</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '12px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>3</span>
                  <span>Presioná <strong>"Agregar"</strong>.</span>
                </div>
              </div>
            )}

            {/* Android Chrome / Samsung con prompt nativo directo */}
            {deferredPrompt && (
              <div style={{ width: '100%', textAlign: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '6px' }}>¡Instalación directa lista!</div>
                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px', lineHeight: '1.4' }}>
                  Podés instalar el panel de control oficial CRM en tu teléfono en 1 clic.
                </div>

                <button
                  onClick={handleInstallClick}
                  style={{
                    backgroundColor: '#1D4ED8',
                    color: '#FFFFFF',
                    border: 'none',
                    width: '100%',
                    padding: '14px',
                    borderRadius: '14px',
                    fontWeight: 700,
                    fontSize: '15px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <span>📲</span>
                  <span>Instalar CRM Ahora</span>
                </button>
              </div>
            )}

            {/* Android / Desktop sin prompt directo */}
            {!deferredPrompt && (browserType.startsWith('android_') || browserType === 'desktop') && !isInAppBrowser && (
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginBottom: '10px' }}>Instalar desde el menú de tu navegador:</div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>1</span>
                  <span>Tocá el menú de <strong>tres puntos ⋮</strong> arriba a la derecha.</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '8px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>2</span>
                  <span>Seleccioná <strong>"Instalar aplicación"</strong> o <strong>"Agregar a pantalla principal"</strong>.</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', marginBottom: '12px', fontSize: '12.5px', color: '#334155' }}>
                  <span style={{ backgroundColor: '#1A56DB', color: '#FFF', fontWeight: 700, borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', flexShrink: 0 }}>3</span>
                  <span>Presioná <strong>"Instalar"</strong>.</span>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setShowGuideModal(false);
                handleDismissBanner();
              }}
              style={{
                marginTop: '12px',
                backgroundColor: '#1A56DB',
                color: '#FFFFFF',
                border: 'none',
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                fontWeight: 700,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
