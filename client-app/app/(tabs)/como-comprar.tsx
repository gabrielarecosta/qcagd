import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import MaterialCommunityIcons from '../../components/icons/MaterialCommunityIcons';
import { AppFooter } from '../../components/AppFooter';

export default function ComoComprarScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const [showFloatingBar, setShowFloatingBar] = useState(true);

  // Número oficial de WhatsApp especificado: +54 9 3584 83-8335
  const WHATSAPP_CONSULTAS_PHONE = '5493584838335';

  const handleOpenWhatsApp = () => {
    const text = encodeURIComponent(
      'Hola! Quisiera recibir asesoramiento personalizado para realizar una compra en Química General Deheza.'
    );
    Linking.openURL(`https://wa.me/${WHATSAPP_CONSULTAS_PHONE}?text=${text}`).catch(() => {});
  };

  const handleOpenWhatsAppDudas = () => {
    const text = encodeURIComponent(
      'Hola! Tengo dudas sobre los productos o modalidad de compra de Química General Deheza. ¿Me podrían asesorar?'
    );
    Linking.openURL(`https://wa.me/${WHATSAPP_CONSULTAS_PHONE}?text=${text}`).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={[
          styles.scrollView,
          Platform.OS === 'web' && ({ overflowY: 'scroll' } as any),
        ]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
        persistentScrollbar={true}
        // @ts-ignore
        dataSet={{ mainScroll: 'true' }}
      >
        {/* ======================================================== */}
        {/* HERO BANNER                                              */}
        {/* ======================================================== */}
        <View style={styles.heroBanner}>
          <View style={[styles.heroBannerInner, isDesktop && styles.heroBannerInnerDesktop]}>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="help-circle-outline" size={15} color="#BFDBFE" style={{ marginRight: 6 }} />
              <Text style={styles.heroBadgeText}>GUÍA DE COMPRA · FÁCIL, RÁPIDO Y SEGURO</Text>
            </View>

            <h1 style={{ margin: 0 }}>
              <Text style={styles.heroTitle}>¿Cómo comprar en Química General Deheza?</Text>
            </h1>
            <Text style={styles.heroSubtitle}>
              Encontrá la forma de compra que mejor se adapta a vos.
            </Text>

            {/* Banner destacado interactivo con redirección a Mayoristas */}
            <View style={styles.calloutBox}>
              <MaterialCommunityIcons name="information" size={20} color="#1A56DB" style={{ marginRight: 10, marginTop: 2 }} />
              <Text style={styles.calloutText}>
                Comprá online solicitando tu cuenta mayorista completando el formulario (
                <Text
                  style={styles.calloutLink}
                  onPress={() => router.push('/(tabs)/mayoristas' as any)}
                >
                  haciendo click acá
                </Text>
                ) o consultá por asesoramiento personalizado.
              </Text>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* TARJETAS FLOTANTES DE MODALIDAD DE COMPRA                */}
        {/* ======================================================== */}
        <View style={styles.sectionContainer}>
          <View style={[styles.cardsGrid, isDesktop && styles.cardsGridDesktop]}>
            
            {/* TARJETA 1: MINORISTA */}
            <View
              style={[styles.floatingCard, styles.minoristaCard]}
              // @ts-ignore
              className="floating-card-interactive"
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconSquircle, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={styles.iconEmoji}>🛒</Text>
                </View>
                <View style={styles.cardTagMinorista}>
                  <Text style={styles.cardTagTextMinorista}>VENTA DIRECTA ONLINE</Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>Minorista</Text>

              <Text style={styles.cardDescription}>
                Comprá online al instante. Elegí tu producto, la cantidad y pagalo directamente desde la web.
                Recibilo en tu casa o retiralo en nuestros locales de General Deheza, Córdoba.
              </Text>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="check-circle" size={17} color="#10B981" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Elegí tus productos al instante sin trámites previos</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="credit-card-outline" size={17} color="#1A56DB" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Pagos seguros con Mercado Pago, tarjetas o contra entrega</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="truck-delivery-outline" size={17} color="#1A56DB" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Envíos a domicilio en General Deheza y zona en 24 horas</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="store-outline" size={17} color="#1A56DB" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Retiro gratuito en nuestro local comercial</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.cardBtnPrimary}
                onPress={() => router.push('/(tabs)/catalogo' as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.cardBtnPrimaryText}>Ir al Catálogo de Productos →</Text>
              </TouchableOpacity>
            </View>

            {/* TARJETA 2: MAYORISTA */}
            <View
              style={[styles.floatingCard, styles.mayoristaCard]}
              // @ts-ignore
              className="floating-card-interactive"
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconSquircle, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={styles.iconEmoji}>🏢</Text>
                </View>
                <View style={styles.cardTagMayorista}>
                  <Text style={styles.cardTagTextMayorista}>PORTAL B2B COMERCIOS</Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>Mayorista</Text>

              <Text style={styles.cardDescription}>
                Comprá online solicitando tu cuenta mayorista completando el formulario (
                <Text
                  style={styles.cardInlineLink}
                  onPress={() => router.push('/(tabs)/mayoristas' as any)}
                >
                  haciendo click acá
                </Text>
                ) o consultá por asesoramiento personalizado.
              </Text>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="tag-outline" size={17} color="#1A56DB" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Precios diferenciales por bulto cerrado y volumen</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="file-document-outline" size={17} color="#1A56DB" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Facturación A o B para empresas, lavaderos y comercios</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="account-tie-outline" size={17} color="#1A56DB" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Atención y asesoramiento técnico por WhatsApp</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="truck-fast" size={17} color="#10B981" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Repartos programados a locales en toda la región</Text>
                </View>
              </View>

              <View style={styles.cardButtonsCol}>
                <TouchableOpacity
                  style={styles.cardBtnMayorista}
                  onPress={() => router.push('/(tabs)/mayoristas' as any)}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="clipboard-text-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.cardBtnMayoristaText}>Completar Formulario Mayorista</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cardBtnWhatsApp}
                  onPress={handleOpenWhatsApp}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="whatsapp" size={17} color="#15803D" style={{ marginRight: 6 }} />
                  <Text style={styles.cardBtnWhatsAppText}>Consultar por WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* TARJETA 3: ENVÍOS Y RETIROS */}
            <View
              style={[styles.floatingCard, styles.enviosCard]}
              // @ts-ignore
              className="floating-card-interactive"
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconSquircle, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={styles.iconEmoji}>🚚</Text>
                </View>
                <View style={styles.cardTagEnvios}>
                  <Text style={styles.cardTagTextEnvios}>LOGÍSTICA Y RETIRO</Text>
                </View>
              </View>

              <Text style={styles.cardTitle}>Envíos en 24 Horas</Text>

              <Text style={styles.cardDescription}>
                Entregas a domicilio en General Deheza y zona en 24 horas, o retiro inmediato sin costo en nuestros locales comerciales.
              </Text>

              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="clock-fast" size={17} color="#1A56DB" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Repartos rápidos a tu puerta en 24 horas hábiles</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="map-marker-radius" size={17} color="#1A56DB" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Cobertura en General Deheza, General Cabrera y zona</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="shield-check" size={17} color="#10B981" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Mercadería protegida y garantizada directo de fábrica</Text>
                </View>
                <View style={styles.featureItem}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={17} color="#1A56DB" style={styles.featureIcon} />
                  <Text style={styles.featureText}>Avisos y estado en tiempo real del chofer asignado</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.cardBtnSecondary}
                onPress={() => router.push('/(tabs)/catalogo' as any)}
                activeOpacity={0.85}
              >
                <Text style={styles.cardBtnSecondaryText}>Explorar Productos Disponibles</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>

        {/* ======================================================== */}
        {/* PASO A PASO CÓMO COMPRAR                                  */}
        {/* ======================================================== */}
        <View style={styles.stepsSection}>
          <Text style={styles.stepsSectionTitle}>El proceso es simple y transparente en 4 pasos:</Text>
          
          <View style={[styles.stepsGrid, isDesktop && styles.stepsGridDesktop]}>
            <View style={styles.stepCard}>
              <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepCardTitle}>Explorá el Catálogo</Text>
              <Text style={styles.stepCardDesc}>
                Buscá los artículos de limpieza que necesitás filtrando por categoría, presentación o nombre.
              </Text>
            </View>

            <View style={styles.stepCard}>
              <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepCardTitle}>Armá tu Carrito</Text>
              <Text style={styles.stepCardDesc}>
                Elegí la cantidad de unidades o bultos. Revisá el subtotal y calculá tu mínimo de compra online ($30.000).
              </Text>
            </View>

            <View style={styles.stepCard}>
              <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>3</Text></View>
              <Text style={styles.stepCardTitle}>Elegí Entrega y Pago</Text>
              <Text style={styles.stepCardDesc}>
                Seleccioná envío a domicilio o retiro en sucursal, y pagá con Mercado Pago, transferencia o en efectivo.
              </Text>
            </View>

            <View style={styles.stepCard}>
              <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>4</Text></View>
              <Text style={styles.stepCardTitle}>¡Recibí tu Pedido!</Text>
              <Text style={styles.stepCardDesc}>
                Te llevamos tu pedido en 24 horas en General Deheza y zona, o te avisamos cuando esté listo para retirar.
              </Text>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* FOOTER                                                   */}
        {/* ======================================================== */}
        <AppFooter />
      </ScrollView>

      {/* ======================================================== */}
      {/* BARRA AZUL FLOTANTE INFERIOR                            */}
      {/* ======================================================== */}
      {showFloatingBar && (
        <View
          style={[
            styles.floatingBottomBarWrap,
            Platform.OS === 'web' && ({ position: 'fixed', bottom: 18, zIndex: 9999 } as any),
          ]}
        >
          <View style={[styles.floatingBottomBar, isDesktop && styles.floatingBottomBarDesktop]}>
            <View style={styles.floatingBottomInfoCol}>
              <View style={styles.floatingBottomIconCircle}>
                <MaterialCommunityIcons name="whatsapp" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.floatingBottomTextContainer}>
                <Text style={styles.floatingBottomTitle}>¿Tenés dudas?</Text>
                <Text style={styles.floatingBottomSubtitle}>
                  Estamos para ayudarte a encontrar el producto o modalidad de compra adecuada. Escribinos por WhatsApp
                </Text>
              </View>
            </View>

            <View style={styles.floatingBottomActionRow}>
              <TouchableOpacity
                style={styles.floatingBottomBtn}
                onPress={handleOpenWhatsAppDudas}
                activeOpacity={0.88}
              >
                <MaterialCommunityIcons name="whatsapp" size={18} color="#15803D" style={{ marginRight: 6 }} />
                <Text style={styles.floatingBottomBtnText}>Escribinos por WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.floatingBottomCloseBtn}
                onPress={() => setShowFloatingBar(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Cerrar aviso"
              >
                <MaterialCommunityIcons name="close" size={18} color="rgba(255, 255, 255, 0.8)" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Inyección de CSS para la animación fluida de las tarjetas flotantes en Web */}
      {Platform.OS === 'web' && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
            .floating-card-interactive {
              transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s ease, border-color 0.28s ease;
            }
            .floating-card-interactive:hover {
              transform: translateY(-8px) scale(1.025);
              box-shadow: 0 20px 35px -8px rgba(26, 86, 219, 0.22), 0 8px 16px -6px rgba(26, 86, 219, 0.12) !important;
              border-color: #3B82F6 !important;
            }
          `,
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
    ...(Platform.OS === 'web' ? {
      overflowY: 'scroll',
    } : {}),
  },
  content: {
    paddingBottom: 110, // Espacio para que la barra flotante no tape el contenido al final
  },

  // Hero Banner
  heroBanner: {
    backgroundColor: '#0A192F', // Azul oscuro elegante institucional
    paddingVertical: 48,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  heroBannerInner: {
    maxWidth: 1040,
    marginHorizontal: 'auto',
    width: '100%',
    alignItems: 'center',
    textAlign: 'center',
  },
  heroBannerInnerDesktop: {
    paddingHorizontal: 24,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.4)',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    marginBottom: 16,
  },
  heroBadgeText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: Platform.OS === 'web' ? 32 : 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 700,
    lineHeight: 24,
    marginBottom: 24,
  },

  // Callout banner informativo
  calloutBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: Radius.lg,
    paddingVertical: 14,
    paddingHorizontal: 18,
    maxWidth: 820,
    width: '100%',
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  calloutText: {
    flex: 1,
    fontSize: 14,
    color: '#1E3A8A',
    lineHeight: 22,
    fontWeight: '500',
  },
  calloutLink: {
    color: '#1A56DB',
    fontWeight: '800',
    textDecorationLine: 'underline',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },

  // Grid de tarjetas flotantes
  sectionContainer: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
    paddingHorizontal: 16,
    marginTop: -28,
  },
  cardsGrid: {
    flexDirection: 'column',
    gap: 20,
  },
  cardsGridDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 24,
  },

  // Tarjeta Flotante Base
  floatingCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
    justifyContent: 'space-between',
    ...(Platform.OS === 'web' ? ({ cursor: 'default' } as any) : {}),
  },
  minoristaCard: {
    borderTopWidth: 4,
    borderTopColor: '#1A56DB',
  },
  mayoristaCard: {
    borderTopWidth: 4,
    borderTopColor: '#2563EB',
    backgroundColor: '#FFFFFF',
  },
  enviosCard: {
    borderTopWidth: 4,
    borderTopColor: '#3B82F6',
  },

  // Encabezado de tarjeta
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconSquircle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 24,
  },
  cardTagMinorista: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  cardTagTextMinorista: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1A56DB',
    letterSpacing: 0.5,
  },
  cardTagMayorista: {
    backgroundColor: '#DBEAFE',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  cardTagTextMayorista: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1E40AF',
    letterSpacing: 0.5,
  },
  cardTagEnvios: {
    backgroundColor: '#F0FDF4',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  cardTagTextEnvios: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  cardDescription: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 21,
    marginBottom: 18,
  },
  cardInlineLink: {
    color: '#1A56DB',
    fontWeight: '800',
    textDecorationLine: 'underline',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },

  // Lista de características / beneficios
  featuresList: {
    gap: 10,
    marginBottom: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  featureIcon: {
    marginRight: 8,
    marginTop: 2,
    flexShrink: 0,
  },
  featureText: {
    flex: 1,
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
    fontWeight: '500',
  },

  // Botones de acción
  cardButtonsCol: {
    gap: 8,
  },
  cardBtnPrimary: {
    backgroundColor: '#1A56DB',
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cardBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  cardBtnMayorista: {
    backgroundColor: '#1A56DB',
    borderRadius: Radius.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cardBtnMayoristaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cardBtnWhatsApp: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: Radius.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cardBtnWhatsAppText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
  },
  cardBtnSecondary: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cardBtnSecondaryText: {
    color: '#1A56DB',
    fontSize: 13,
    fontWeight: '700',
  },

  // Paso a paso
  stepsSection: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 48,
  },
  stepsSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 20,
    textAlign: 'center',
  },
  stepsGrid: {
    flexDirection: 'column',
    gap: 16,
  },
  stepsGridDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
  },
  stepCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    alignItems: 'center',
    textAlign: 'center',
  },
  stepNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A56DB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  stepCardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  stepCardDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    textAlign: 'center',
  },

  // Barra Azul Flotante Inferior
  floatingBottomBarWrap: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    paddingHorizontal: 16,
    pointerEvents: 'box-none',
  },
  floatingBottomBar: {
    backgroundColor: '#1A56DB', // Color azul vibrante y elegante
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#60A5FA',
    paddingVertical: 14,
    paddingHorizontal: 20,
    maxWidth: 960,
    width: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 12,
  },
  floatingBottomBarDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  floatingBottomInfoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  floatingBottomIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  floatingBottomTextContainer: {
    flex: 1,
  },
  floatingBottomTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  floatingBottomSubtitle: {
    fontSize: 13,
    color: '#EFF6FF',
    lineHeight: 18,
    marginTop: 2,
    fontWeight: '500',
  },
  floatingBottomActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
    width: Platform.OS === 'web' ? 'auto' : '100%',
    justifyContent: 'flex-end',
  },
  floatingBottomBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    flexGrow: Platform.OS === 'web' ? 0 : 1,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  floatingBottomBtnText: {
    color: '#15803D',
    fontSize: 13.5,
    fontWeight: '800',
  },
  floatingBottomCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
});

