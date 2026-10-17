import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius } from '../../constants/Spacing';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { formatPrice } from '../../utils/formatters';
import { CATEGORY_ICONS } from '../../types';
import { HoverImagePreview } from './HoverImagePreview';
import { AuthModal } from '../modals/AuthModal';
import { TopMarqueeBar } from './TopMarqueeBar';
import { useAccountTabStore } from '../../store/accountTabStore';
import { CartPreviewItemRow } from './CartPreviewItemRow';

interface AppTopNavbarProps {
  activeRoute?: string;
}

export function AppTopNavbar({ activeRoute }: AppTopNavbarProps) {
  const router = useRouter();
  const currentPath = usePathname();
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

  const checkIsActive = (path: string) => {
    if (activeRoute) {
      return activeRoute === path;
    }
    if (path === '/') return currentPath === '/' || currentPath === '/(tabs)' || currentPath === '';
    return currentPath.includes(path);
  };

  if (isDesktop) {
    return (
      <View style={{ width: '100%' }}>
        <TopMarqueeBar />
        <View style={styles.desktopHeader}>
        <View style={styles.desktopHeaderInner}>
          {/* Logo y Marca */}
          <TouchableOpacity
            style={styles.desktopBrand}
            onPress={() => router.push('/(tabs)' as any)}
            activeOpacity={0.8}
          >
            <Image
              source={require('../../assets/logo2.png')}
              style={styles.desktopLogo}
              resizeMode="cover"
            />
            <Text style={styles.desktopBrandText}>Química General Deheza</Text>
          </TouchableOpacity>

            {/* Menú de Navegación Principal */}
          <View style={styles.desktopNav}>
            {!isRepartidor && (
              <>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)' as any)}
                  style={[styles.desktopNavLink, checkIsActive('/') && styles.desktopNavLinkActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.desktopNavText, checkIsActive('/') && styles.desktopNavTextActive]}>
                    Inicio
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/catalogo' as any)}
                  style={[styles.desktopNavLink, (checkIsActive('/catalogo') || activeRoute === '/catalogo') && styles.desktopNavLinkActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.desktopNavText, (checkIsActive('/catalogo') || activeRoute === '/catalogo') && styles.desktopNavTextActive]}>
                    Catálogo
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/mayoristas' as any)}
                  style={[styles.desktopNavLink, (checkIsActive('/mayoristas') || activeRoute === '/mayoristas') && styles.desktopNavLinkActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.desktopNavText, (checkIsActive('/mayoristas') || activeRoute === '/mayoristas') && styles.desktopNavTextActive]}>
                    Mayoristas
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/como-comprar' as any)}
                  style={[styles.desktopNavLink, (checkIsActive('/como-comprar') || activeRoute === '/como-comprar') && styles.desktopNavLinkActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.desktopNavText, (checkIsActive('/como-comprar') || activeRoute === '/como-comprar') && styles.desktopNavTextActive]}>
                    ¿Cómo comprar?
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {isRepartidor && (
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/reparto' as any)}
                style={[styles.desktopNavLink, checkIsActive('/reparto') && styles.desktopNavLinkActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.desktopNavText, checkIsActive('/reparto') && styles.desktopNavTextActive]}>
                  Mis Repartos
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Área de Usuario y Carrito */}
          <View style={styles.desktopUserArea}>
            {!isRepartidor && (
              <View style={{ marginRight: 20, position: 'relative', zIndex: 9999 }}>
                <TouchableOpacity
                  onPress={() => setShowCartPreview(!showCartPreview)}
                  style={styles.desktopCartIconBtn}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="cart" size={24} color={Colors.primary} />
                  {totalItems > 0 && (
                    <View style={styles.desktopHeaderCartBadge}>
                      <Text style={styles.desktopHeaderCartBadgeText}>{totalItems}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Popover Preview Dropdown */}
                {showCartPreview && (
                  <>
                    <TouchableOpacity
                      style={styles.invisibleBackdrop}
                      activeOpacity={1}
                      onPress={() => setShowCartPreview(false)}
                    />
                    <View style={styles.cartPreviewDropdown}>
                      <View style={styles.cartPreviewHeader}>
                        <Text style={styles.cartPreviewTitle}>Mi Carrito ({totalItems})</Text>
                        <TouchableOpacity onPress={() => setShowCartPreview(false)}>
                          <MaterialCommunityIcons name="close" size={18} color={Colors.textSecondary} />
                        </TouchableOpacity>
                      </View>

                      {items.length === 0 ? (
                        <View style={styles.cartPreviewEmpty}>
                          <Text style={styles.cartPreviewEmptyText}>Tu carrito está vacío.</Text>
                        </View>
                      ) : (
                        <>
                          {/* Lupa / Buscador en el carrito de la esquina superior derecha */}
                          <View style={styles.cartPreviewSearchWrap}>
                            <MaterialCommunityIcons name="magnify" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                            <TextInput
                              style={styles.cartPreviewSearchInput}
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
                            <View style={styles.cartPreviewEmpty}>
                              <MaterialCommunityIcons name="magnify-close" size={24} color={Colors.textSecondary} style={{ marginBottom: 4 }} />
                              <Text style={styles.cartPreviewEmptyText}>No hay artículos con "{cartPreviewSearch}"</Text>
                              <TouchableOpacity onPress={() => setCartPreviewSearch('')} style={{ marginTop: 6 }}>
                                <Text style={{ fontSize: 12, color: Colors.primary, fontWeight: '600' }}>Ver todos ({items.length})</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <ScrollView
                              style={[
                                styles.cartPreviewScroll,
                                Platform.OS === 'web' && ({
                                  maxHeight: 290,
                                  overflowY: 'scroll',
                                  scrollbarWidth: 'thin',
                                  scrollbarColor: '#94A3B8 #F1F5F9',
                                } as any),
                              ]}
                              contentContainerStyle={styles.cartPreviewScrollContent}
                              showsVerticalScrollIndicator={true}
                              persistentScrollbar={true}
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

                          <View style={styles.cartPreviewFooter}>
                            <View style={styles.cartPreviewTotalRow}>
                              <Text style={styles.cartPreviewTotalLabel}>Total:</Text>
                              <Text style={styles.cartPreviewTotalVal}>{formatPrice(totalPrice)}</Text>
                            </View>
                            <TouchableOpacity
                              style={styles.cartPreviewGoBtn}
                              onPress={() => {
                                setShowCartPreview(false);
                                router.push('/(tabs)/carrito' as any);
                              }}
                            >
                              <Text style={styles.cartPreviewGoBtnText}>Ver Carrito Completo</Text>
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
                style={styles.desktopUserBtn}
                activeOpacity={0.8}
                accessibilityLabel="Mi Cuenta / Iniciar sesión"
              >
                <MaterialCommunityIcons
                  name={isLoggedIn ? 'account-circle' : 'account-circle-outline'}
                  size={22}
                  color={Colors.primary}
                />
                <Text style={styles.desktopUserBtnText}>
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
                    style={styles.invisibleBackdrop}
                    activeOpacity={1}
                    onPress={() => setShowUserDropdown(false)}
                  />
                  <View style={styles.userDropdownMenu}>
                    <View style={styles.userDropdownHeader}>
                      <Text style={styles.userDropdownName} numberOfLines={1}>{clientData?.nombre || 'Cliente'}</Text>
                      <Text style={styles.userDropdownEmail} numberOfLines={1}>{clientData?.email || clientData?.telefono || ''}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.userDropdownItem}
                      onPress={() => {
                        setShowUserDropdown(false);
                        useAccountTabStore.getState().setActiveTab('datos');
                        router.push({ pathname: '/(tabs)/cuenta', params: { tab: 'datos' } } as any);
                      }}
                    >
                      <MaterialCommunityIcons name="account-details-outline" size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                      <Text style={styles.userDropdownItemText}>Mis Datos & Domicilios</Text>
                    </TouchableOpacity>
                    {!isRepartidor && (
                      <>
                        <TouchableOpacity
                          style={styles.userDropdownItem}
                          onPress={() => {
                            setShowUserDropdown(false);
                            useAccountTabStore.getState().setActiveTab('pedidos');
                            router.push({ pathname: '/(tabs)/cuenta', params: { tab: 'pedidos' } } as any);
                          }}
                        >
                          <MaterialCommunityIcons name="clipboard-list-outline" size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                          <Text style={styles.userDropdownItemText}>Mis Pedidos</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.userDropdownItem}
                          onPress={() => {
                            setShowUserDropdown(false);
                            useAccountTabStore.getState().setActiveTab('listas');
                            router.push({ pathname: '/(tabs)/cuenta', params: { tab: 'listas' } } as any);
                          }}
                        >
                          <MaterialCommunityIcons name="bookmark-outline" size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                          <Text style={styles.userDropdownItemText}>Mis Listas</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.userDropdownItem}
                          onPress={() => {
                            setShowUserDropdown(false);
                            router.push('/(tabs)/reparto' as any);
                          }}
                        >
                          <MaterialCommunityIcons name="truck-delivery-outline" size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                          <Text style={styles.userDropdownItemText}>Estado de mi Reparto</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.userDropdownItem}
                          onPress={() => {
                            setShowUserDropdown(false);
                            useAccountTabStore.getState().setActiveTab('todos');
                            router.push({ pathname: '/(tabs)/cuenta', params: { tab: 'todos' } } as any);
                          }}
                        >
                          <MaterialCommunityIcons name="view-dashboard-outline" size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                          <Text style={styles.userDropdownItemText}>Ver Todo mi Perfil</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {isRepartidor && (
                      <TouchableOpacity
                        style={styles.userDropdownItem}
                        onPress={() => {
                          setShowUserDropdown(false);
                          router.push('/(tabs)/reparto' as any);
                        }}
                      >
                        <MaterialCommunityIcons name="truck-delivery-outline" size={17} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                        <Text style={styles.userDropdownItemText}>Mis Repartos</Text>
                      </TouchableOpacity>
                    )}
                    <View style={styles.userDropdownDivider} />
                    <TouchableOpacity
                      style={styles.userDropdownItem}
                      onPress={() => {
                        setShowUserDropdown(false);
                        logout();
                      }}
                    >
                      <MaterialCommunityIcons name="logout" size={17} color="#EF4444" style={{ marginRight: 8 }} />
                      <Text style={[styles.userDropdownItemText, { color: '#EF4444', fontWeight: 'bold' }]}>Cerrar sesión</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
        <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
        </View>
      </View>
    );
  }

  // Versión Móvil
  return (
    <View style={{ width: '100%' }}>
      <TopMarqueeBar />
      <View style={styles.mobileHeader}>
        <TouchableOpacity
          style={styles.mobileBrand}
          onPress={() => router.push('/(tabs)' as any)}
          activeOpacity={0.8}
        >
          <Image
            source={require('../../assets/logo2.png')}
            style={styles.mobileLogo}
            resizeMode="contain"
          />
          <Text style={styles.mobileBrandText} numberOfLines={1}>Química General Deheza</Text>
        </TouchableOpacity>

        <View style={styles.mobileNavRight}>
          <TouchableOpacity
            style={styles.mobileNavBtn}
            onPress={() => router.push('/(tabs)/catalogo' as any)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="view-grid-outline" size={20} color={Colors.textPrimary} />
            <Text style={styles.mobileNavBtnText}>Catálogo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mobileNavBtn}
            onPress={() => router.push('/(tabs)/carrito' as any)}
            activeOpacity={0.7}
          >
            <View style={{ position: 'relative' }}>
              <MaterialCommunityIcons name="cart-outline" size={22} color={Colors.primary} />
              {totalItems > 0 && (
                <View style={styles.mobileCartBadge}>
                  <Text style={styles.mobileCartBadgeText}>{totalItems}</Text>
                </View>
              )}
            </View>
            <Text style={styles.mobileNavBtnText}>Carrito</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mobileNavBtn}
            onPress={() => {
              useAccountTabStore.getState().setActiveTab('datos');
              router.push('/(tabs)/cuenta' as any);
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="account-circle-outline" size={22} color={Colors.textPrimary} />
            <Text style={styles.mobileNavBtnText}>Cuenta</Text>
          </TouchableOpacity>
        </View>
        <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Desktop Header
  desktopHeader: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    width: '100%',
    height: 70,
    justifyContent: 'center',
    zIndex: 1000,
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
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
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
    fontSize: 13,
    color: Colors.textSecondary,
  },
  cartPreviewScroll: {
    maxHeight: 290,
  },
  cartPreviewScrollContent: {
    paddingHorizontal: 12,
  },
  cartPreviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cartPreviewItemImgWrap: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  cartPreviewItemImg: {
    width: '100%',
    height: '100%',
  },
  cartPreviewItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cartPreviewItemDetails: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cartPreviewFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
  },
  cartPreviewTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cartPreviewTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cartPreviewTotalVal: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  cartPreviewGoBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  cartPreviewGoBtnText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700',
  },

  // Mobile Header
  mobileHeader: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  mobileBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  mobileBrandText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  mobileNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mobileNavBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileNavBtnText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  mobileCartBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: Colors.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  mobileCartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
