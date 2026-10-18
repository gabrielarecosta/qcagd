import React, { useState, useRef, useMemo } from 'react';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, useWindowDimensions, TextInput, ScrollView } from 'react-native';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { useCartStore } from '../../store/cartStore';
import { Badge } from '../../components/ui/Badge';
import { useAuthStore } from '../../store/authStore';
import { Radius, Spacing } from '../../constants/Spacing';
import MaterialCommunityIcons from '../../components/icons/MaterialCommunityIcons';
import { formatPrice as fmtPrice } from '../../utils/formatters';
import { CATEGORY_ICONS, ProductCategory } from '../../types';

import { NoAddressBanner } from '../../components/ui/NoAddressBanner';
import { AuthModal } from '../../components/modals/AuthModal';
import { TopMarqueeBar } from '../../components/ui/TopMarqueeBar';
import { useAccountTabStore } from '../../store/accountTabStore';
import { CartPreviewItemRow } from '../../components/ui/CartPreviewItemRow';

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
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeProduct = useCartStore((state) => state.removeProduct);
  const [showCartPreview, setShowCartPreview] = useState(false);
  const [cartPreviewSearch, setCartPreviewSearch] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const { isLoggedIn, userRole, logout, clientData } = useAuthStore();
  const isRepartidor = isLoggedIn && userRole === 'repartidor';

  const filteredPreviewItems = useMemo(() => {
    if (!cartPreviewSearch.trim()) return items;
    const q = cartPreviewSearch.trim().toLowerCase();
    return items.filter((item) => {
      const name = (item.producto?.nombre || '').toLowerCase();
      const code = (item.producto?.codigo || '').toLowerCase();
      const pres = (item.producto?.presentacion || '').toLowerCase();
      const cat = (item.producto?.categoria || '').toLowerCase();
      return name.includes(q) || code.includes(q) || pres.includes(q) || cat.includes(q);
    });
  }, [items, cartPreviewSearch]);

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/' || pathname === '/(tabs)' || pathname === '';
    return pathname.includes(path);
  };


  // Si está logueado, mostramos el navegador según si es Escritorio o Móvil
  if (isDesktop) {
    return (
      <View style={desktopStyles.desktopContainer}>
        {/* Barra dinámica superior en azul oscuro */}
        <TopMarqueeBar />
        {/* Encabezado tradicional web */}
        <View style={desktopStyles.desktopHeader}>
          <View style={desktopStyles.desktopHeaderInner}>
            <View style={desktopStyles.desktopBrand}>
              <Image source={require('../../assets/logo2.png')} style={desktopStyles.desktopLogo} resizeMode="cover" />
              <Text style={desktopStyles.desktopBrandText}>Química General Deheza</Text>
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
                  <TouchableOpacity onPress={() => router.push('/(tabs)/mayoristas' as any)} style={[desktopStyles.desktopNavLink, isActive('/mayoristas') && desktopStyles.desktopNavLinkActive]}>
                    <Text style={[desktopStyles.desktopNavText, isActive('/mayoristas') && desktopStyles.desktopNavTextActive]}>Mayoristas</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/como-comprar' as any)} style={[desktopStyles.desktopNavLink, isActive('/como-comprar') && desktopStyles.desktopNavLinkActive]}>
                    <Text style={[desktopStyles.desktopNavText, isActive('/como-comprar') && desktopStyles.desktopNavTextActive]}>¿Cómo comprar?</Text>
                  </TouchableOpacity>
                </>
              )}
              {isRepartidor && (
                <TouchableOpacity onPress={() => router.push('/(tabs)/reparto')} style={[desktopStyles.desktopNavLink, isActive('/reparto') && desktopStyles.desktopNavLinkActive]}>
                  <Text style={[desktopStyles.desktopNavText, isActive('/reparto') && desktopStyles.desktopNavTextActive]}>Mis Repartos</Text>
                </TouchableOpacity>
              )}
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
                    <>
                      <TouchableOpacity
                        style={desktopStyles.invisibleBackdrop}
                        activeOpacity={1}
                        onPress={() => setShowCartPreview(false)}
                      />
                      <View style={desktopStyles.cartPreviewDropdown}>
                        <View style={desktopStyles.cartPreviewHeader}>
                          <Text style={desktopStyles.cartPreviewTitle}>Mi Carrito ({totalItems})</Text>
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
                            {/* Lupa / Buscador en el carrito de la esquina superior derecha */}
                            <View style={desktopStyles.cartPreviewSearchWrap}>
                              <MaterialCommunityIcons name="magnify" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                              <TextInput
                                style={desktopStyles.cartPreviewSearchInput}
                                placeholder="Buscar en el carrito..."
                                placeholderTextColor={Colors.textSecondary}
                                value={cartPreviewSearch}
                                onChangeText={setCartPreviewSearch}
                              />
                              {!!cartPreviewSearch && (
                                <TouchableOpacity onPress={() => setCartPreviewSearch('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                                  <MaterialCommunityIcons name="close-circle" size={15} color={Colors.textSecondary} />
                                </TouchableOpacity>
                              )}
                            </View>

                            {filteredPreviewItems.length === 0 ? (
                              <View style={desktopStyles.cartPreviewEmpty}>
                                <MaterialCommunityIcons name="magnify-close" size={24} color={Colors.textSecondary} style={{ marginBottom: 4 }} />
                                <Text style={desktopStyles.cartPreviewEmptyText}>No hay artículos con "{cartPreviewSearch}"</Text>
                                <TouchableOpacity onPress={() => setCartPreviewSearch('')} style={{ marginTop: 6 }}>
                                  <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600' }}>Ver todos ({items.length})</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <ScrollView
                                style={[
                                  desktopStyles.cartPreviewScroll,
                                  Platform.OS === 'web' && ({
                                    maxHeight: 290,
                                    overflowY: 'scroll',
                                    scrollbarWidth: 'thin',
                                    scrollbarColor: '#94A3B8 #F1F5F9',
                                  } as any),
                                ]}
                                contentContainerStyle={desktopStyles.cartPreviewScrollContent}
                                showsVerticalScrollIndicator={true}
                                persistentScrollbar={true}
                                // @ts-ignore
                                dataSet={{ cartScroll: 'true', testid: 'cart-preview-scroll' }}
                              >
                                {filteredPreviewItems.map((item) => (
                                  <CartPreviewItemRow
                                    key={item.producto.id}
                                    item={item}
                                    onUpdateQty={(qty) => updateQuantity(item.producto.id, qty)}
                                    onRemove={() => removeProduct(item.producto.id)}
                                    onOpenProduct={() => {
                                      setShowCartPreview(false);
                                      router.push(`/producto/${item.producto.id}` as any);
                                    }}
                                  />
                                ))}
                              </ScrollView>
                            )}

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
                    </>
                  )}
                </View>
              )}

              {/* Muñequito / User Account Icon Button */}
              <View style={{ position: 'relative', zIndex: 9999 }}>
                <TouchableOpacity
                  onPress={() => {
                    if (isLoggedIn) {
                      setShowUserDropdown(!showUserDropdown);
                    } else {
                      setShowAuthModal(true);
                    }
                  }}
                  style={desktopStyles.desktopUserBtn}
                  activeOpacity={0.8}
                  accessibilityLabel="Mi Cuenta / Iniciar sesión"
                >
                  <MaterialCommunityIcons
                    name={isLoggedIn ? 'account-circle' : 'account-circle-outline'}
                    size={22}
                    color={Colors.primary}
                  />
                  <Text style={desktopStyles.desktopUserBtnText}>
                    {isLoggedIn && clientData ? (clientData.nombre ? clientData.nombre.split(' ')[0] : 'Mi Cuenta') : 'Ingresar'}
                  </Text>
                  {isLoggedIn && (
                    <MaterialCommunityIcons name={showUserDropdown ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.textSecondary} />
                  )}
                </TouchableOpacity>

                {/* Dropdown de usuario logueado */}
                {isLoggedIn && showUserDropdown && (
                  <>
                    <TouchableOpacity
                      style={desktopStyles.invisibleBackdrop}
                      activeOpacity={1}
                      onPress={() => setShowUserDropdown(false)}
                    />
                    <View style={desktopStyles.userDropdownMenu}>
                      <View style={desktopStyles.userDropdownHeader}>
                        <Text style={desktopStyles.userDropdownName} numberOfLines={1}>{clientData?.nombre || 'Cliente'}</Text>
                        <Text style={desktopStyles.userDropdownEmail} numberOfLines={1}>{clientData?.email || clientData?.telefono || ''}</Text>
                      </View>
                      <TouchableOpacity
                        style={desktopStyles.userDropdownItem}
                        onPress={() => {
                          setShowUserDropdown(false);
                          useAccountTabStore.getState().setActiveTab('datos');
                          router.push({ pathname: '/(tabs)/cuenta', params: { tab: 'datos' } } as any);
                        }}
                      >
                        <MaterialCommunityIcons name="account-details-outline" size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                        <Text style={desktopStyles.userDropdownItemText}>Mis Datos & Domicilios</Text>
                      </TouchableOpacity>
                      {!isRepartidor && (
                        <>
                          <TouchableOpacity
                            style={desktopStyles.userDropdownItem}
                            onPress={() => {
                              setShowUserDropdown(false);
                              useAccountTabStore.getState().setActiveTab('pedidos');
                              router.push({ pathname: '/(tabs)/cuenta', params: { tab: 'pedidos' } } as any);
                            }}
                          >
                            <MaterialCommunityIcons name="clipboard-list-outline" size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                            <Text style={desktopStyles.userDropdownItemText}>Mis Pedidos</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={desktopStyles.userDropdownItem}
                            onPress={() => {
                              setShowUserDropdown(false);
                              useAccountTabStore.getState().setActiveTab('listas');
                              router.push({ pathname: '/(tabs)/cuenta', params: { tab: 'listas' } } as any);
                            }}
                          >
                            <MaterialCommunityIcons name="bookmark-outline" size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                            <Text style={desktopStyles.userDropdownItemText}>Mis Listas</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={desktopStyles.userDropdownItem}
                            onPress={() => {
                              setShowUserDropdown(false);
                              router.push('/(tabs)/reparto' as any);
                            }}
                          >
                            <MaterialCommunityIcons name="truck-delivery-outline" size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                            <Text style={desktopStyles.userDropdownItemText}>Estado de mi Reparto</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={desktopStyles.userDropdownItem}
                            onPress={() => {
                              setShowUserDropdown(false);
                              useAccountTabStore.getState().setActiveTab('todos');
                              router.push({ pathname: '/(tabs)/cuenta', params: { tab: 'todos' } } as any);
                            }}
                          >
                            <MaterialCommunityIcons name="view-dashboard-outline" size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                            <Text style={desktopStyles.userDropdownItemText}>Ver Todo mi Perfil</Text>
                          </TouchableOpacity>
                        </>
                      )}
                      {isRepartidor && (
                        <TouchableOpacity
                          style={desktopStyles.userDropdownItem}
                          onPress={() => {
                            setShowUserDropdown(false);
                            router.push('/(tabs)/reparto');
                          }}
                        >
                          <MaterialCommunityIcons name="truck-delivery-outline" size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                          <Text style={desktopStyles.userDropdownItemText}>Mis Repartos</Text>
                        </TouchableOpacity>
                      )}
                      <View style={desktopStyles.userDropdownDivider} />
                      <TouchableOpacity
                        style={desktopStyles.userDropdownItem}
                        onPress={() => {
                          setShowUserDropdown(false);
                          logout();
                        }}
                      >
                        <MaterialCommunityIcons name="logout" size={17} color="#EF4444" style={{ marginRight: 8 }} />
                        <Text style={[desktopStyles.userDropdownItemText, { color: '#EF4444', fontWeight: 'bold' }]}>Cerrar sesión</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Contenedor principal de contenido (centrado con max width) */}
        <View style={desktopStyles.desktopContentWrapper}>
          <NoAddressBanner />
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' }, // Ocultar barra de tabs móvil en escritorio
            }}
          >
            <Tabs.Screen name="index" options={{ href: isRepartidor ? null : undefined }} />
            <Tabs.Screen name="catalogo" options={{ href: isRepartidor ? null : undefined }} />
            <Tabs.Screen name="mayoristas" options={{ href: isRepartidor ? null : undefined }} />
            <Tabs.Screen name="como-comprar" options={{ href: isRepartidor ? null : undefined }} />
            <Tabs.Screen name="carrito" options={{ href: isRepartidor ? null : undefined }} />
            <Tabs.Screen name="listas" options={{ href: isRepartidor ? null : undefined }} />
            <Tabs.Screen name="reparto" />
            <Tabs.Screen name="cuenta" />
          </Tabs>
        </View>
        <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Barra dinámica superior en azul oscuro */}
      <TopMarqueeBar />

      {/* Encabezado Móvil de Marca */}
      <View style={mobileHeaderStyles.container}>
        <TouchableOpacity
          style={mobileHeaderStyles.brand}
          onPress={() => router.push('/(tabs)' as any)}
          activeOpacity={0.8}
        >
          <Image
            source={require('../../assets/logo2.png')}
            style={mobileHeaderStyles.logo}
            resizeMode="contain"
          />
          <View style={mobileHeaderStyles.brandTextWrap}>
            <Text style={mobileHeaderStyles.brandTitle} numberOfLines={1}>
              Química General Deheza
            </Text>
            <Text style={mobileHeaderStyles.brandSubtitle}>Distribuidora Oficial</Text>
          </View>
        </TouchableOpacity>

        <View style={mobileHeaderStyles.actionsRow}>
          {isLoggedIn ? (
            <TouchableOpacity
              style={mobileHeaderStyles.userPill}
              onPress={() => {
                useAccountTabStore.getState().setActiveTab('todos');
                router.push('/(tabs)/cuenta' as any);
              }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="account-circle" size={20} color={Colors.primary} />
              <Text style={mobileHeaderStyles.userNameText} numberOfLines={1}>
                {clientData?.nombre ? clientData.nombre.split(' ')[0] : 'Cuenta'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={mobileHeaderStyles.loginBtn}
              onPress={() => setShowAuthModal(true)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="account-circle-outline" size={17} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={mobileHeaderStyles.loginBtnText}>Ingresar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <NoAddressBanner />
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
          name="mayoristas"
          options={{
            title: 'Mayoristas',
            href: isRepartidor ? null : undefined,
            tabBarIcon: ({ focused }) => (
              <MaterialCommunityIcons name="storefront-outline" size={24} color={focused ? Colors.tabActive : Colors.tabInactive} />
            ),
          }}
        />
        <Tabs.Screen
          name="como-comprar"
          options={{
            href: null, // Oculto del tab bar móvil, accesible desde menú y links
          }}
        />
        <Tabs.Screen
          name="carrito"
          options={{
            title: 'Carrito',
            href: isRepartidor ? null : undefined,
            tabBarIcon: ({ focused }) => (
              <CartIcon focused={focused} count={totalItems} />
            ),
          }}
        />
        <Tabs.Screen
          name="listas"
          options={{
            href: null, // Oculto del tab bar móvil, accesible desde Mi Cuenta
          }}
        />
        <Tabs.Screen
          name="reparto"
          options={{
            title: 'Mis Repartos',
            href: isRepartidor ? undefined : null, // Oculto para clientes, accesible desde Mi Cuenta
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
      <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </View>
  );
}

const mobileHeaderStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
    zIndex: 50,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
    marginRight: 8,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 6,
  },
  brandTextWrap: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.1,
  },
  brandSubtitle: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    gap: 4,
    maxWidth: 120,
  },
  userNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.xs,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    height: Platform.OS === 'web' ? 64 : 80,
    paddingBottom: Platform.OS === 'web' ? 8 : 20,
    paddingTop: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: FontWeight.semibold,
    marginTop: 2,
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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  desktopLogo: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
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
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
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
    gap: 12,
  },
  desktopUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  desktopUserBtnText: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  userDropdownMenu: {
    position: 'absolute',
    top: 50,
    right: 0,
    width: 220,
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    zIndex: 10000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  userDropdownHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 4,
  },
  userDropdownName: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  userDropdownEmail: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  userDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  userDropdownItemText: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  userDropdownDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  desktopLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  desktopLogoutText: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: '#ef4444',
  },
  desktopContentWrapper: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 0,
    backgroundColor: Colors.background,
  },
  desktopCartIconBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  invisibleBackdrop: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9995,
    backgroundColor: 'transparent',
  },
  cartPreviewDropdown: {
    position: 'absolute',
    top: 50,
    right: 0,
    width: 390,
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
    zIndex: 10000,
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
  cartPreviewSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
  },
  cartPreviewSearchInput: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
    paddingVertical: 2,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
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
  cartPreviewScroll: {
    maxHeight: 290,
  },
  cartPreviewScrollContent: {
    paddingLeft: 14,
    paddingRight: 10,
    paddingBottom: 6,
  },
  cartPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
    gap: 10,
  },
  cartPreviewItemImgWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cartPreviewItemImg: {
    width: 44,
    height: 44,
  },
  cartPreviewItemName: {
    fontSize: 13,
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


