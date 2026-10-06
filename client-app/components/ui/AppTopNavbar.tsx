import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Platform,
  useWindowDimensions,
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
  const [showCartPreview, setShowCartPreview] = useState(false);

  const { isLoggedIn, userRole, logout } = useAuthStore();
  const isRepartidor = isLoggedIn && userRole === 'repartidor';

  const checkIsActive = (path: string) => {
    if (activeRoute) {
      return activeRoute === path;
    }
    if (path === '/') return currentPath === '/' || currentPath === '/(tabs)' || currentPath === '';
    return currentPath.includes(path);
  };

  if (isDesktop) {
    return (
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
                  onPress={() => router.push('/(tabs)/carrito' as any)}
                  style={[styles.desktopNavLink, checkIsActive('/carrito') && styles.desktopNavLinkActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.desktopNavText, checkIsActive('/carrito') && styles.desktopNavTextActive]}>
                    Mis Pedidos
                  </Text>
                  {totalItems > 0 && (
                    <View style={styles.desktopCartBadge}>
                      <Text style={styles.desktopCartBadgeText}>{totalItems}</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/listas' as any)}
                  style={[styles.desktopNavLink, checkIsActive('/listas') && styles.desktopNavLinkActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.desktopNavText, checkIsActive('/listas') && styles.desktopNavTextActive]}>
                    Mis Listas
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/reparto' as any)}
              style={[styles.desktopNavLink, checkIsActive('/reparto') && styles.desktopNavLinkActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.desktopNavText, checkIsActive('/reparto') && styles.desktopNavTextActive]}>
                Mis Repartos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/cuenta' as any)}
              style={[styles.desktopNavLink, checkIsActive('/cuenta') && styles.desktopNavLinkActive]}
              activeOpacity={0.7}
            >
              <Text style={[styles.desktopNavText, checkIsActive('/cuenta') && styles.desktopNavTextActive]}>
                Mi Cuenta
              </Text>
            </TouchableOpacity>
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
                  <View style={styles.cartPreviewDropdown}>
                    <View style={styles.cartPreviewHeader}>
                      <Text style={styles.cartPreviewTitle}>Mis Pedidos ({totalItems})</Text>
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
                        <ScrollView
                          style={[
                            styles.cartPreviewScroll,
                            Platform.OS === 'web' && ({
                              maxHeight: 240,
                              overflowY: 'scroll',
                              scrollbarWidth: 'thin',
                              scrollbarColor: '#94A3B8 #F1F5F9',
                            } as any),
                          ]}
                          contentContainerStyle={styles.cartPreviewScrollContent}
                          showsVerticalScrollIndicator={true}
                        >
                          {items.map((item) => {
                            const iconName = (CATEGORY_ICONS as any)?.[item.producto.categoria] || 'package-variant';
                            return (
                              <TouchableOpacity
                                key={item.producto.id}
                                style={styles.cartPreviewItem}
                                onPress={() => {
                                  setShowCartPreview(false);
                                  router.push('/(tabs)/carrito' as any);
                                }}
                                activeOpacity={0.7}
                              >
                                <View style={styles.cartPreviewItemImgWrap}>
                                  {item.producto.imagen ? (
                                    <HoverImagePreview
                                      imageUri={item.producto.imagen}
                                      images={item.producto.imagenes}
                                      name={item.producto.nombre}
                                      price={item.producto.precio}
                                      presentation={item.producto.presentacion}
                                      codigo={item.producto.codigo}
                                      style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                      <Image
                                        source={{ uri: item.producto.imagen }}
                                        style={styles.cartPreviewItemImg}
                                        resizeMode="contain"
                                      />
                                    </HoverImagePreview>
                                  ) : (
                                    <MaterialCommunityIcons
                                      name={iconName as any}
                                      size={22}
                                      color={Colors.primary}
                                    />
                                  )}
                                </View>

                                <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                                  <Text style={styles.cartPreviewItemName} numberOfLines={1}>
                                    {item.producto.nombre}
                                  </Text>
                                  <Text style={styles.cartPreviewItemDetails}>
                                    {item.cantidad} u. × {formatPrice(item.producto.precio)}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>

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
                )}
              </View>
            )}

            {isLoggedIn ? (
              <TouchableOpacity onPress={logout} style={styles.desktopLogoutBtn}>
                <MaterialCommunityIcons name="logout" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                <Text style={styles.desktopLogoutText}>Salir</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/(tabs)' as any, params: { tab: 'login' } })}
                style={[styles.desktopLogoutBtn, { borderColor: Colors.primary }]}
              >
                <MaterialCommunityIcons name="login" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.desktopLogoutText, { color: Colors.primary }]}>Ingresar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  // Versión Móvil
  return (
    <View style={styles.mobileHeader}>
      <TouchableOpacity
        style={styles.mobileBrand}
        onPress={() => router.push('/(tabs)' as any)}
        activeOpacity={0.8}
      >
        <Image
          source={require('../../assets/logo2.png')}
          style={styles.mobileLogo}
          resizeMode="cover"
        />
        <Text style={styles.mobileBrandText}>Química QGD</Text>
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
          <Text style={styles.mobileNavBtnText}>Pedidos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.mobileNavBtn}
          onPress={() => router.push('/(tabs)/cuenta' as any)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="account-circle-outline" size={22} color={Colors.textPrimary} />
          <Text style={styles.mobileNavBtnText}>Cuenta</Text>
        </TouchableOpacity>
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
    fontSize: 13,
    color: Colors.textSecondary,
  },
  cartPreviewScroll: {
    maxHeight: 240,
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
