import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { AuthModal } from '../modals/AuthModal';

export function GuestAccountScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');

  const handleOpenAuth = (tab: 'login' | 'register') => {
    setAuthTab(tab);
    setShowAuthModal(true);
  };

  const handleOpenWhatsApp = () => {
    const phone = '5493584820847';
    const msg = encodeURIComponent('Hola! Necesito ayuda para ingresar a mi cuenta en Química General Deheza.');
    Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {});
  };

  return (
    <ScrollView
      style={styles.scrollContainer}
      contentContainerStyle={[
        styles.contentContainer,
        isDesktop ? styles.contentContainerDesktop : styles.contentContainerMobile,
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.mainCard, isDesktop ? styles.mainCardDesktop : styles.mainCardMobile]}>
        {/* Badge Icono Principal */}
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="account-circle-outline" size={48} color={Colors.primary} />
        </View>

        {/* Encabezado */}
        <Text style={styles.title}>Mi Cuenta</Text>
        <Text style={styles.subtitle}>
          Iniciá sesión o registrate para gestionar tus pedidos, ver el seguimiento en vivo y guardar tus direcciones.
        </Text>

        {/* Botones Principales de Autenticación */}
        <View style={[styles.actionsGroup, isDesktop ? styles.actionsGroupDesktop : styles.actionsGroupMobile]}>
          <TouchableOpacity
            style={styles.primaryLoginBtn}
            onPress={() => handleOpenAuth('login')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="login" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryLoginBtnText}>Iniciar Sesión</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryRegisterBtn}
            onPress={() => handleOpenAuth('register')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="account-plus-outline" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryRegisterBtnText}>Crear Cuenta</Text>
          </TouchableOpacity>
        </View>

        {/* Separador */}
        <View style={styles.divider} />

        {/* Beneficios de tener cuenta */}
        <View style={styles.benefitsSection}>
          <Text style={styles.benefitsTitle}>¿Por qué ingresar con tu cuenta?</Text>

          <View style={styles.benefitItem}>
            <View style={[styles.benefitIconWrap, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
              <MaterialCommunityIcons name="truck-fast-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.benefitTextWrap}>
              <Text style={styles.benefitHeader}>Seguimiento en Tiempo Real</Text>
              <Text style={styles.benefitSub}>
                Monitoreá tu reparto y enterate al instante cuando el chofer esté en camino.
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={[styles.benefitIconWrap, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
              <MaterialCommunityIcons name="history" size={20} color="#059669" />
            </View>
            <View style={styles.benefitTextWrap}>
              <Text style={styles.benefitHeader}>Historial y Repetición de Pedidos</Text>
              <Text style={styles.benefitSub}>
                Revisá compras anteriores y repetí tus pedidos habituales en 1 solo clic.
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={[styles.benefitIconWrap, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
              <MaterialCommunityIcons name="map-marker-outline" size={20} color="#D97706" />
            </View>
            <View style={styles.benefitTextWrap}>
              <Text style={styles.benefitHeader}>Direcciones Guardadas</Text>
              <Text style={styles.benefitSub}>
                Agilizá tus compras guardando domicilios de entrega frecuentes.
              </Text>
            </View>
          </View>

          <View style={styles.benefitItem}>
            <View style={[styles.benefitIconWrap, { backgroundColor: '#F3E8FF', borderColor: '#E9D5FF' }]}>
              <MaterialCommunityIcons name="tag-outline" size={20} color="#9333EA" />
            </View>
            <View style={styles.benefitTextWrap}>
              <Text style={styles.benefitHeader}>Precios Especiales y Mayoristas</Text>
              <Text style={styles.benefitSub}>
                Acceso a listas de precios acordadas y beneficios exclusivos por volumen.
              </Text>
            </View>
          </View>
        </View>

        {/* Separador */}
        <View style={styles.divider} />

        {/* Accesos Rápidos */}
        <View style={styles.quickLinksSection}>
          <TouchableOpacity
            style={styles.quickLinkRow}
            onPress={() => router.push('/(tabs)/catalogo' as any)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="view-grid-outline" size={19} color={Colors.primary} style={{ marginRight: 10 }} />
            <Text style={styles.quickLinkText}>Explorar Catálogo de Productos</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickLinkRow}
            onPress={() => router.push('/(tabs)/mayoristas' as any)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="storefront-outline" size={19} color={Colors.primary} style={{ marginRight: 10 }} />
            <Text style={styles.quickLinkText}>Portal Clientes Mayoristas</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickLinkRow}
            onPress={() => router.push('/(tabs)' as any)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="home-outline" size={19} color={Colors.primary} style={{ marginRight: 10 }} />
            <Text style={styles.quickLinkText}>Volver a la Tienda de Inicio</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#94A3B8" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        {/* Soporte WhatsApp */}
        <TouchableOpacity
          style={styles.whatsappCard}
          onPress={handleOpenWhatsApp}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="whatsapp" size={22} color="#16A34A" style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.whatsappTitle}>¿Problemas para ingresar?</Text>
            <Text style={styles.whatsappSub}>Contactá por WhatsApp a Casa Central para ayuda inmediata.</Text>
          </View>
          <MaterialCommunityIcons name="open-in-new" size={16} color="#16A34A" />
        </TouchableOpacity>
      </View>

      <AuthModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialTab={authTab}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  contentContainerDesktop: {
    paddingVertical: 36,
  },
  contentContainerMobile: {
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.06)',
    } : {}),
  },
  mainCardDesktop: {
    maxWidth: 600,
    padding: 32,
  },
  mainCardMobile: {
    maxWidth: '100%',
    padding: 18,
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 460,
    marginBottom: 24,
  },
  actionsGroup: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  actionsGroupDesktop: {
    flexDirection: 'row',
  },
  actionsGroupMobile: {
    flexDirection: 'column',
  },
  primaryLoginBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: Radius.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
  primaryLoginBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  secondaryRegisterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: Radius.md,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
  secondaryRegisterBtnText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    width: '100%',
    marginVertical: 20,
  },
  benefitsSection: {
    width: '100%',
    gap: 14,
  },
  benefitsTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#1E293B',
    marginBottom: 4,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  benefitIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitHeader: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#0F172A',
    marginBottom: 2,
  },
  benefitSub: {
    fontSize: FontSize.xs,
    color: '#64748B',
    lineHeight: 18,
  },
  quickLinksSection: {
    width: '100%',
    gap: 8,
  },
  quickLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
  quickLinkText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: '#1E293B',
  },
  whatsappCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: Radius.md,
    padding: 12,
    marginTop: 18,
    width: '100%',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
  whatsappTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#166534',
  },
  whatsappSub: {
    fontSize: 11,
    color: '#15803D',
    marginTop: 1,
  },
});
