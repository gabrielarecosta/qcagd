import React, { useState, useEffect, useRef } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, ScrollView, SafeAreaView, Animated, Image, Platform, useWindowDimensions } from 'react-native';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { useCartStore } from '../../store/cartStore';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore } from '../../store/authStore';
import { Radius, Spacing } from '../../constants/Spacing';
import MaterialCommunityIcons from '../../components/icons/MaterialCommunityIcons';import { formatPrice as fmtPrice } from '../../utils/formatters';

// Módulos de pantalla para el flujo de autenticación bloqueado
import { LoginClienteScreen } from '../../components/screens/LoginClienteScreen';
import { RegisterClienteScreen } from '../../components/screens/RegisterClienteScreen';
import { LoginRepartidorScreen } from '../../components/screens/LoginRepartidorScreen';
import { DesktopStartScreen } from '../../components/screens/DesktopStartScreen';
import { MobileStartScreen } from '../../components/screens/MobileStartScreen';

// Íconos con MaterialCommunityIcons para mayor calidad visual
function HomeIcon({ focused }: { focused: boolean }) {
  return <MaterialCommunityIcons name={focused ? 'home' : 'home-outline'} size={26} color={focused ? Colors.tabActive : Colors.tabInactive} />;
}

function CatalogIcon({ focused }: { focused: boolean }) {
  return <MaterialCommunityIcons name={focused ? 'view-grid' : 'view-grid-outline'} size={26} color={focused ? Colors.tabActive : Colors.tabInactive} />;
}

function CartIcon({ focused, count }: { focused: boolean; count: number }) {
  return (
    <View style={{ position: 'relative' }}>
      <MaterialCommunityIcons name={focused ? 'cart' : 'cart-outline'} size={26} color={focused ? Colors.tabActive : Colors.tabInactive} />
      {count > 0 && <Badge count={count} />}
    </View>
  );
}

function DeliveryIcon({ focused }: { focused: boolean }) {
  return <MaterialCommunityIcons name={focused ? 'truck-delivery' : 'truck-delivery-outline'} size={26} color={focused ? Colors.tabActive : Colors.tabInactive} />;
}

function AccountIcon({ focused }: { focused: boolean }) {
  return <MaterialCommunityIcons name={focused ? 'account-circle' : 'account-circle-outline'} size={26} color={focused ? Colors.tabActive : Colors.tabInactive} />;
}

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const totalItems = useCartStore((state) => state.totalItems());
  const items = useCartStore((state) => state.items);
  const totalPrice = useCartStore((state) => state.totalPrice());
  const [showCartPreview, setShowCartPreview] = useState(false);
  const { isLoggedIn, userRole, logout } = useAuthStore();
  const isRepartidor = isLoggedIn && userRole === 'repartidor';

  const [authStep, setAuthStep] = useState<'landing' | 'options' | 'login-client' | 'register-client' | 'login-driver'>('landing');

  // Animaciones landing
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(0.92)).current;

  // Animaciones pantalla opciones
  const optionsOpacity = useRef(new Animated.Value(0)).current;
  const optionsTranslateY = useRef(new Animated.Value(20)).current;

  // Reset to landing step if user logs out
  useEffect(() => {
    if (!isLoggedIn) {
      setAuthStep('landing');
    }
  }, [isLoggedIn]);

  // Trigger button fade-in + scale animation when landing step mounts
  useEffect(() => {
    if (!isLoggedIn && authStep === 'landing') {
      buttonOpacity.setValue(0);
      buttonScale.setValue(0.92);
      Animated.parallel([
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 900,
          delay: 300,
          useNativeDriver: true,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          delay: 300,
          useNativeDriver: true,
          bounciness: 8,
        }),
      ]).start();
    }
  }, [isLoggedIn, authStep]);

  // Trigger fade+slide for options screen
  useEffect(() => {
    if (authStep === 'options') {
      optionsOpacity.setValue(0);
      optionsTranslateY.setValue(20);
      Animated.parallel([
        Animated.timing(optionsOpacity, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(optionsTranslateY, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]).start();
    }
  }, [authStep]);

  // Si el usuario no está logueado, permitimos únicamente ver el catálogo
  if (!isLoggedIn) {
    const isPublicCatalog = pathname === '/catalogo' || pathname === '/(tabs)/catalogo';
    if (!isPublicCatalog) {
      if (isDesktop) {
        return <DesktopStartScreen />;
      } else {
        return <MobileStartScreen />;
      }
    }
  }

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/' || pathname === '/(tabs)' || pathname === '';
    return pathname.includes(path);
  };

  // Si está logueado, mostramos el navegador según si es Escritorio o Móvil
  if (isDesktop) {
    return (
      <View style={desktopStyles.desktopContainer}>
        {/* Encabezado tradicional web */}
        <View style={desktopStyles.desktopHeader}>
          <View style={desktopStyles.desktopHeaderInner}>
            <View style={desktopStyles.desktopBrand}>
              <Image source={require('../../assets/logo.png')} style={desktopStyles.desktopLogo} />
              <Text style={desktopStyles.desktopBrandText}>Química Deheza</Text>
            </View>

            <View style={desktopStyles.desktopNav}>
              {!isRepartidor && (
                <>
                  <TouchableOpacity onPress={() => router.push('/(tabs)')} style={[desktopStyles.desktopNavLink, isActive('/') && desktopStyles.desktopNavLinkActive]}>
                    <Text style={[desktopStyles.desktopNavText, isActive('/') && desktopStyles.desktopNavTextActive]}>Inicio</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/catalogo')} style={[desktopStyles.desktopNavLink, isActive('/catalogo') && desktopStyles.desktopNavLinkActive]}>
                    <Text style={[desktopStyles.desktopNavText, isActive('/catalogo') && desktopStyles.desktopNavTextActive]}>Catálogo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/carrito')} style={[desktopStyles.desktopNavLink, isActive('/carrito') && desktopStyles.desktopNavLinkActive]}>
                    <Text style={[desktopStyles.desktopNavText, isActive('/carrito') && desktopStyles.desktopNavTextActive]}>Mis Pedidos</Text>
                    {totalItems > 0 && (
                      <View style={desktopStyles.desktopCartBadge}>
                        <Text style={desktopStyles.desktopCartBadgeText}>{totalItems}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => router.push('/(tabs)/reparto')} style={[desktopStyles.desktopNavLink, isActive('/reparto') && desktopStyles.desktopNavLinkActive]}>
                <Text style={[desktopStyles.desktopNavText, isActive('/reparto') && desktopStyles.desktopNavTextActive]}>Mis Repartos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/(tabs)/cuenta')} style={[desktopStyles.desktopNavLink, isActive('/cuenta') && desktopStyles.desktopNavLinkActive]}>
                <Text style={[desktopStyles.desktopNavText, isActive('/cuenta') && desktopStyles.desktopNavTextActive]}>Mi Cuenta</Text>
              </TouchableOpacity>
            </View>

            <View style={desktopStyles.desktopUserArea}>
              {!isRepartidor && (
                <View style={{ marginRight: 24, position: 'relative', zIndex: 9999 }}>
                  <TouchableOpacity
                    onPress={() => setShowCartPreview(!showCartPreview)}
                    style={desktopStyles.desktopCartIconBtn}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="cart" size={24} color={Colors.primary} />
                    {totalItems > 0 && (
                      <View style={desktopStyles.desktopHeaderCartBadge}>
                        <Text style={desktopStyles.desktopHeaderCartBadgeText}>{totalItems}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Popover Preview Dropdown */}
                  {showCartPreview && (
                    <View style={desktopStyles.cartPreviewDropdown}>
                      <View style={desktopStyles.cartPreviewHeader}>
                        <Text style={desktopStyles.cartPreviewTitle}>Mis Pedidos ({totalItems})</Text>
                        <TouchableOpacity onPress={() => setShowCartPreview(false)}>
                          <MaterialCommunityIcons name="close" size={18} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      </View>

                      {items.length === 0 ? (
                        <View style={desktopStyles.cartPreviewEmpty}>
                          <Text style={desktopStyles.cartPreviewEmptyText}>Tu carrito está vacío.</Text>
                        </View>
                      ) : (
                        <>
                          <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ paddingHorizontal: 12 }}>
                            {items.map((item) => (
                              <TouchableOpacity
                                key={item.producto.id}
                                style={desktopStyles.cartPreviewItem}
                                onPress={() => {
                                  setShowCartPreview(false);
                                  router.push('/(tabs)/carrito');
                                }}
                              >
                                <Text style={desktopStyles.cartPreviewItemName} numberOfLines={1}>
                                  {item.producto.nombre}
                                </Text>
                                <Text style={desktopStyles.cartPreviewItemDetails}>
                                  {item.cantidad} u. × {fmtPrice(item.producto.precio)}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>

                          <View style={desktopStyles.cartPreviewFooter}>
                            <View style={desktopStyles.cartPreviewTotalRow}>
                              <Text style={desktopStyles.cartPreviewTotalLabel}>Total:</Text>
                              <Text style={desktopStyles.cartPreviewTotalVal}>{fmtPrice(totalPrice)}</Text>
                            </View>
                            <TouchableOpacity
                              style={desktopStyles.cartPreviewGoBtn}
                              onPress={() => {
                                setShowCartPreview(false);
                                router.push('/(tabs)/carrito');
                              }}
                            >
                              <Text style={desktopStyles.cartPreviewGoBtnText}>Ver Carrito Completo</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </View>
              )}

              {isLoggedIn ? (
                <TouchableOpacity onPress={logout} style={desktopStyles.desktopLogoutBtn}>
                  <MaterialCommunityIcons name="logout" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                  <Text style={desktopStyles.desktopLogoutText}>Salir</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push({ pathname: '/(tabs)', params: { tab: 'login' } })}
                  style={[desktopStyles.desktopLogoutBtn, { borderColor: Colors.primary }]}
                >
                  <MaterialCommunityIcons name="login" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={[desktopStyles.desktopLogoutText, { color: Colors.primary }]}>Ingresar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Contenedor principal de contenido (centrado con max width) */}
        <View style={desktopStyles.desktopContentWrapper}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' }, // Ocultar barra de tabs móvil en escritorio
            }}
          >
            <Tabs.Screen name="index" options={{ href: isRepartidor ? null : undefined }} />
            <Tabs.Screen name="catalogo" options={{ href: isRepartidor ? null : undefined }} />
            <Tabs.Screen name="carrito" options={{ href: isRepartidor ? null : undefined }} />
            <Tabs.Screen name="reparto" />
            <Tabs.Screen name="cuenta" />
          </Tabs>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          href: isRepartidor ? null : undefined,
          tabBarIcon: ({ focused }) => <HomeIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="catalogo"
        options={{
          title: 'Catálogo',
          href: isRepartidor ? null : undefined,
          tabBarIcon: ({ focused }) => <CatalogIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="carrito"
        options={{
          title: 'Mis Pedidos',
          href: isRepartidor ? null : undefined,
          tabBarIcon: ({ focused }) => (
            <CartIcon focused={focused} count={totalItems} />
          ),
        }}
      />
      <Tabs.Screen
        name="reparto"
        options={{
          title: 'Mis Repartos',
          tabBarIcon: ({ focused }) => <DeliveryIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="cuenta"
        options={{
          title: 'Mi Cuenta',
          tabBarIcon: ({ focused }) => <AccountIcon focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tabBackground,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    height: 82,
    paddingBottom: 16,
    paddingTop: 10,
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  tabLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    marginTop: 4,
  },
});

const layoutStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)', // Overlay oscuro para alto contraste
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  centerBox: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  logoText: {
    fontSize: 44,
    fontWeight: FontWeight.extrabold,
    color: Colors.white,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 6,
  },
  taglineText: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginBottom: Spacing.huge,
    fontWeight: FontWeight.semibold,
  },
  landingButton: {
    width: '90%',
    height: 68,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  landingButtonText: {
    color: Colors.primary,
    fontSize: 22,
    fontWeight: FontWeight.bold,
    letterSpacing: 2,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    backgroundColor: Colors.white,
  },
  welcomeEmoji: {
    fontSize: 72,
    marginBottom: Spacing.xl,
  },
  welcomeLogo: {
    width: 150,
    height: 150,
    marginBottom: Spacing.xl,
  },
  guestTitle: {
    fontSize: 28,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  guestDesc: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
    lineHeight: 26,
    paddingHorizontal: Spacing.md,
  },
  primaryButton: {
    width: '100%',
    height: 62,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: FontWeight.bold,
  },
  secondaryButton: {
    width: '100%',
    height: 62,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  secondaryButtonText: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: FontWeight.bold,
  },
  linkButton: {
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  linkButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: FontWeight.semibold,
  },
});

const desktopStyles = StyleSheet.create({
  desktopContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    width: '100%',
  },
  desktopHeader: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    width: '100%',
    height: 70,
    justifyContent: 'center',
    zIndex: 1000,
    // Sombra sutil para profundidad en escritorio
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  desktopHeaderInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  desktopBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  desktopLogo: {
    width: 38,
    height: 38,
  },
  desktopBrandText: {
    fontSize: 18,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  desktopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  desktopNavLink: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  desktopNavLinkActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)', // Light theme primary tint
  },
  desktopNavText: {
    fontSize: 15,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  desktopNavTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  desktopCartBadge: {
    backgroundColor: '#FF1744',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  desktopCartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  desktopUserArea: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  desktopLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#fca5a5', // light red
    backgroundColor: '#fef2f2',
  },
  desktopLogoutText: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: '#ef4444',
  },
  desktopContentWrapper: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 32,
    backgroundColor: Colors.background,
  },
  desktopCartIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  desktopHeaderCartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  desktopHeaderCartBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  cartPreviewDropdown: {
    position: 'absolute',
    top: 50,
    right: 0,
    width: 320,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
    paddingVertical: 12,
  },
  cartPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 8,
  },
  cartPreviewTitle: {
    fontSize: 15,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  cartPreviewEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  cartPreviewEmptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  cartPreviewItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  cartPreviewItemName: {
    fontSize: 14,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  cartPreviewItemDetails: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  cartPreviewFooter: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  cartPreviewTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartPreviewTotalLabel: {
    fontSize: 14,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  cartPreviewTotalVal: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  cartPreviewGoBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cartPreviewGoBtnText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    fontSize: 13,
  },
});


