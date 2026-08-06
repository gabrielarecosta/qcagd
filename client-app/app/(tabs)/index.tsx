import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing, TouchTarget } from '../../constants/Spacing';
import { useOrderStore } from '../../store/orderStore';
import { useCatalogStore } from '../../store/catalogStore';
import { OrderCard } from '../../components/OrderCard';
import { ProductCard } from '../../components/ProductCard';
import { useCartStore } from '../../store/cartStore';
import { getFirstName, formatPrice } from '../../utils/formatters';
import { useAuthStore } from '../../store/authStore';
import { CATEGORY_ICONS, CATEGORY_LABELS, ProductCategory, Product, Order } from '../../types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEntrance } from '../../hooks/useEntrance';

const QUICK_CATEGORIES: ProductCategory[] = ['limpieza', 'quimicos', 'perfumeria', 'descartables', 'piscina', 'industrial', 'hogar', 'institucional'];

const OFFER_CARD_COLORS = [
  '#0d5c66', // Deep Teal
  '#5c061c', // Wine Red
  '#1d3557', // Slate Blue
  '#1e3f20', // Forest Green
  '#5f0f40', // Dark Plum
  '#7c2d12', // Warm Rust
  '#334155', // Slate Grey
];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const { repeatOrder, addProduct } = useCartStore();
  const { orders, activeDeliveryOrder, deliveredOrders, fetchOrders } = useOrderStore();
  const { isLoggedIn, clientData, userRole } = useAuthStore();
  const { fetchProducts, fetchSuperOffers, superOffers, fetchBanners, banners, fetchCategoryBanners, categoryBanners, fetchCategoryNames, categoryNames } = useCatalogStore();

  const [bannerIndex, setBannerIndex] = React.useState(0);
  const [selectedOfferDetails, setSelectedOfferDetails] = React.useState<any | null>(null);
  const bannerScrollRef = React.useRef<ScrollView>(null);
  const isDraggingBanner = React.useRef(false);

  // Animaciones de entrada escalonadas
  const headerAnim = useEntrance({ delay: 0, duration: 350 });
  const offersAnim = useEntrance({ delay: 60, duration: 380 });
  const bannersPromoAnim = useEntrance({ delay: 110, duration: 380 });
  const bannerAnim = useEntrance({ delay: 150, duration: 350 });
  const quickActionsAnim = useEntrance({ delay: 220, duration: 380 });
  const categoriesAnim = useEntrance({ delay: 300, duration: 380 });
  const frequentAnim = useEntrance({ delay: 380, duration: 400 });
  const historialAnim = useEntrance({ delay: 460, duration: 400 });

  React.useEffect(() => {
    if (isLoggedIn && userRole === 'repartidor') {
      router.replace('/reparto');
    } else {
      fetchProducts();
      fetchSuperOffers();
      fetchBanners();
      fetchCategoryBanners();
      fetchCategoryNames();
      if (isLoggedIn && clientData) {
        fetchOrders(clientData.id);
      }
    }
  }, [isLoggedIn, userRole, clientData]);

  // Auto-play for promotional banners (runs on desktop/web)
  React.useEffect(() => {
    if (!isDesktop || banners.length <= 1) return;

    const timer = setInterval(() => {
      if (!isDraggingBanner.current) {
        const nextIdx = (bannerIndex + 1) % banners.length;
        bannerScrollRef.current?.scrollTo({
          x: nextIdx * width,
          animated: true,
        });
        setBannerIndex(nextIdx);
      }
    }, 5500);

    return () => clearInterval(timer);
  }, [bannerIndex, banners.length, isDesktop, width]);

  // Adjust scroll position if width changes
  React.useEffect(() => {
    if (isDesktop && banners.length > 1) {
      bannerScrollRef.current?.scrollTo({
        x: bannerIndex * width,
        animated: false,
      });
    }
  }, [width]);

  const addOfferToCart = (offer: any) => {
    const items: any[] = offer.super_offer_items || [];
    if (items.length === 0) return;
    items.forEach((it: any) => {
      if (it.products) {
        addProduct(
          { ...it.products, precio: offer.precio_oferta / items.length },
          Math.ceil(it.cantidad)
        );
      }
    });
    router.push('/(tabs)/carrito');
  };

  if (isLoggedIn && userRole === 'repartidor') {
    return null;
  }

  const displayName = isLoggedIn && clientData ? clientData.nombre : 'Invitado';
  const firstName = getFirstName(displayName);
  const activeOrder = activeDeliveryOrder();
  const lastDelivered = deliveredOrders()[0];

  const handleRepeatOrder = (order: Order) => {
    repeatOrder(order);
    router.push('/(tabs)/carrito');
  };

  const handleViewDelivery = () => {
    router.push('/(tabs)/reparto');
  };

  const handleCategoryPress = (category: ProductCategory) => {
    router.push({
      pathname: '/(tabs)/catalogo',
      params: { categoria: category }
    });
  };

  // Calcular los 4 productos más frecuentes basados en el historial de pedidos mock
  const frequentProducts = React.useMemo(() => {
    const counts: Record<string, { product: Product; count: number }> = {};
    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (counts[item.producto.id]) {
          counts[item.producto.id].count += item.cantidad;
        } else {
          counts[item.producto.id] = {
            product: item.producto,
            count: item.cantidad,
          };
        }
      });
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((x) => x.product);
  }, [orders]);

  const handleBannerScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / width);
    if (idx !== bannerIndex && idx >= 0 && idx < banners.length) {
      setBannerIndex(idx);
    }
  };

  const renderPromotionalBanners = (mode: 'desktop' | 'mobile') => {
    if (banners.length === 0) return null;
    const isDesk = mode === 'desktop';
    
    return (
      <Animated.View style={bannersPromoAnim.animatedStyle}>
        <View style={isDesk ? [styles.bannersSectionDesktop, { width: width, marginLeft: -32, borderRadius: 0 }] : styles.bannersSection}>
          <ScrollView
            ref={isDesk ? bannerScrollRef : null}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={isDesk ? styles.bannersScrollDesktop : styles.bannersScroll}
            pagingEnabled={isDesk}
            onScrollBeginDrag={() => { if (isDesk) isDraggingBanner.current = true; }}
            onScrollEndDrag={() => { if (isDesk) isDraggingBanner.current = false; }}
            onMomentumScrollEnd={(e) => {
              if (isDesk) {
                isDraggingBanner.current = false;
                handleBannerScroll(e);
              }
            }}
          >
            {banners.map((banner) => (
              <View key={banner.id} style={isDesk ? [styles.bannerCardDesktop, { width: width }] : styles.bannerCard}>
                {banner.imagen ? (
                  <Image
                    source={{ uri: banner.imagen }}
                    style={isDesk ? styles.bannerImageDesktop : styles.bannerImage}
                    resizeMode="cover"
                  />
                ) : null}
                <View style={[styles.bannerOverlay, isDesk && { paddingLeft: 48, paddingRight: 48, paddingBottom: 28 }]}>
                  <Text style={isDesk ? styles.bannerTitleDesktop : styles.bannerTitle} numberOfLines={1}>{banner.titulo}</Text>
                  {banner.subtitulo ? (
                    <Text style={isDesk ? styles.bannerSubtitleDesktop : styles.bannerSubtitle} numberOfLines={2}>{banner.subtitulo}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isDesktop && renderPromotionalBanners('desktop')}

        {/* === HEADER === */}
        <Animated.View style={[styles.header, headerAnim.animatedStyle]}>
          <View>
            <Text style={styles.greeting}>¡Hola, {firstName}! 👋</Text>
            <Text style={styles.subGreeting}>¿Qué necesitás hoy?</Text>
          </View>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* === SÚPER OFERTAS! === */}
        {superOffers.length > 0 && (
          <Animated.View style={offersAnim.animatedStyle}>
            <View style={styles.offersSection}>
              <View style={styles.offersTitleRow}>
                <Text style={styles.offersNeonTitle}>🔥 SÚPER OFERTAS!</Text>
                <Text style={styles.offersSubtitle}>Por tiempo limitado o hasta agotar stock</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.offersScroll}
              >
                {superOffers.map((offer: any, index: number) => {
                  const discount = offer.precio_original > 0
                    ? Math.round(((offer.precio_original - offer.precio_oferta) / offer.precio_original) * 100)
                    : 0;
                  const items: any[] = offer.super_offer_items || [];
                  const cardColor = OFFER_CARD_COLORS[index % OFFER_CARD_COLORS.length];
                  return (
                    <TouchableOpacity
                      key={offer.id}
                      style={[styles.offerCard, { backgroundColor: cardColor, borderColor: 'rgba(255, 255, 255, 0.12)' }]}
                      onPress={() => setSelectedOfferDetails(offer)}
                      activeOpacity={0.9}
                    >
                      {/* Contenedor de Badges para evitar superposición */}
                      <View style={styles.cardBadgesRow}>
                        {discount > 0 ? (
                          <View style={styles.cardDiscountBadge}>
                            <Text style={styles.cardDiscountBadgeText}>-{discount}%</Text>
                          </View>
                        ) : (
                          <View />
                        )}
                        <View style={styles.cardUrgencyBadge}>
                          <MaterialCommunityIcons name="flash" size={10} color="#FFD700" />
                          <Text style={styles.cardUrgencyText}>¡QUEDAN POCOS!</Text>
                        </View>
                      </View>

                      <Text style={[styles.offerName, { color: '#FFFFFF' }]} numberOfLines={2}>{offer.nombre}</Text>
                      {offer.descripcion ? (
                        <Text style={[styles.offerDesc, { color: 'rgba(255, 255, 255, 0.7)' }]} numberOfLines={2}>{offer.descripcion}</Text>
                      ) : null}
                      {items.length > 0 && (
                        <View style={styles.offerItems}>
                          {items.slice(0, 3).map((it: any) => (
                            <Text key={it.id} style={[styles.offerItem, { color: 'rgba(255, 255, 255, 0.7)' }]} numberOfLines={1}>
                              • {it.cantidad} {it.unidad} {it.products?.nombre || ''}
                            </Text>
                          ))}
                          {items.length > 3 && (
                            <Text style={[styles.offerItem, { color: 'rgba(255, 255, 255, 0.7)' }]}>+ {items.length - 3} más...</Text>
                          )}
                        </View>
                      )}
                      <View style={styles.offerPrices}>
                        <Text style={[styles.offerOriginalPrice, { color: 'rgba(255, 255, 255, 0.5)' }]}>{formatPrice(offer.precio_original)}</Text>
                        <Text style={[styles.offerPromoPrice, { color: '#FFD700' }]}>{formatPrice(offer.precio_oferta)}</Text>
                      </View>
                      <View
                        style={[styles.offerBtn, { backgroundColor: '#FFFFFF' }]}
                      >
                        <Text style={[styles.offerBtnText, { color: cardColor }]}>🔍 Ver Combo</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </Animated.View>
        )}

        {/* === BANNERS PROMOCIONALES === */}
        {!isDesktop && renderPromotionalBanners('mobile')}

        {/* === BANNER REPARTO ACTIVO === */}
        {activeOrder && (
          <Animated.View style={bannerAnim.animatedStyle}>
            <TouchableOpacity
              style={styles.deliveryBanner}
              onPress={handleViewDelivery}
              activeOpacity={0.88}
            >
              <View style={styles.deliveryBannerContent}>
                <View style={styles.deliveryBannerIconBg}>
                  <MaterialCommunityIcons name="truck-delivery" size={24} color="#fff" />
                </View>
                <View style={styles.deliveryBannerText}>
                  <Text style={styles.deliveryBannerTitle}>Tu pedido está en camino</Text>
                  <Text style={styles.deliveryBannerSub}>
                    {activeOrder.numero} · {activeOrder.estado === 'en_camino' ? 'En reparto' : 'En preparación'}
                  </Text>
                </View>
              </View>
              <View style={styles.deliveryBannerArrow}>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#fff" />
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* === ACCIONES RÁPIDAS === */}
        <Animated.View style={[styles.section, quickActionsAnim.animatedStyle]}>
          <Text style={styles.sectionTitle}>Acciones rápidas</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickAction, styles.quickActionPrimary]}
              onPress={() => router.push('/(tabs)/catalogo')}
              activeOpacity={0.88}
            >
              <MaterialCommunityIcons name="cart-plus" size={28} color={Colors.white} />
              <Text style={styles.quickActionLabelPrimary}>Hacer pedido</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickAction, styles.quickActionSecondary]}
              onPress={() => lastDelivered && handleRepeatOrder(lastDelivered)}
              activeOpacity={0.88}
            >
              <MaterialCommunityIcons name="refresh" size={26} color={Colors.primary} />
              <Text style={styles.quickActionLabel}>Repetir último{'\n'}pedido</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickAction, styles.quickActionSecondary]}
              onPress={handleViewDelivery}
              activeOpacity={0.88}
            >
              <MaterialCommunityIcons name="map-marker" size={26} color={Colors.primary} />
              <Text style={styles.quickActionLabel}>Estado del{'\n'}reparto</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* === SECCIÓN REPETIR ÚLTIMO PEDIDO DETALLADO === */}
        {lastDelivered && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Repetir último pedido</Text>
            <OrderCard
              order={lastDelivered}
              onRepeat={handleRepeatOrder}
              style={styles.lastOrderCard}
              delay={0}
            />
          </View>
        )}

        {/* === CATEGORÍAS === */}
        <Animated.View style={[styles.section, categoriesAnim.animatedStyle]}>
          <Text style={styles.sectionTitle}>Categorías principales</Text>
          <View style={[styles.categoriesList, isDesktop && styles.categoriesListDesktop]}>
            {QUICK_CATEGORIES.map((cat, i) => {
              const bannerUrl = categoryBanners[cat] || '';
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryBannerCard, isDesktop && styles.categoryBannerCardDesktop]}
                  onPress={() => handleCategoryPress(cat)}
                  activeOpacity={0.82}
                >
                  {bannerUrl ? (
                    <Image
                      source={{ uri: bannerUrl }}
                      style={styles.categoryBannerBg}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.categoryBannerBg, { backgroundColor: '#F1F5F9' }]} />
                  )}
                  <View style={styles.categoryBannerOverlay} />
                  <View style={[styles.categoryBannerContent, isDesktop && styles.categoryBannerContentDesktop]}>
                    <View style={styles.categoryBannerIconBg}>
                      <MaterialCommunityIcons name={CATEGORY_ICONS[cat] as any} size={24} color="#fff" />
                    </View>
                    <Text style={[styles.categoryBannerText, isDesktop && styles.categoryBannerTextDesktop]}>
                      {categoryNames[cat] || CATEGORY_LABELS[cat]}
                    </Text>
                    {!isDesktop && (
                      <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" style={{ marginLeft: 'auto' }} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* === PRODUCTOS FRECUENTES === */}
        <Animated.View style={[styles.section, frequentAnim.animatedStyle]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Productos frecuentes</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/catalogo')} activeOpacity={0.7}>
              <Text style={styles.sectionLink}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.frequentGrid}>
            {frequentProducts.map((product, index) => (
              <View key={product.id} style={styles.frequentCardContainer}>
                <ProductCard product={product} delay={index * 60} />
              </View>
            ))}
          </View>
        </Animated.View>

        {/* === ÚLTIMOS PEDIDOS HISTORIAL === */}
        <Animated.View style={[styles.section, historialAnim.animatedStyle]}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Historial de pedidos</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/cuenta')} activeOpacity={0.7}>
              <Text style={styles.sectionLink}>Ver cuenta</Text>
            </TouchableOpacity>
          </View>

          {orders.slice(0, 2).map((order, i) => (
            <OrderCard
              key={order.id}
              order={order}
              onRepeat={handleRepeatOrder}
              style={styles.orderCard}
              delay={i * 80}
            />
          ))}
        </Animated.View>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>

      {/* ── Modal Detalle de Oferta Combo ── */}
      {selectedOfferDetails && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedOfferDetails(null)}>
              <MaterialCommunityIcons name="close" size={24} color="#64748b" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {/* Header inside modal */}
              <View style={styles.modalTextDetails}>
                <View style={styles.modalUrgencyRow}>
                  <MaterialCommunityIcons name="flash" size={16} color="#EAB308" />
                  <Text style={styles.modalUrgencyText}>🔥 ¡APÚRATE! QUEDAN POCOS COMBOS</Text>
                </View>
                <Text style={styles.modalOfferName}>{selectedOfferDetails.nombre}</Text>
                
                {/* Description info */}
                {selectedOfferDetails.descripcion ? (
                  <Text style={styles.modalOfferDescText}>{selectedOfferDetails.descripcion}</Text>
                ) : (
                  <Text style={styles.modalOfferDescText}>Este combo promocional contiene una selección especial de artículos de limpieza y perfumería.</Text>
                )}

                <View style={styles.modalOfferPricesRow}>
                  <Text style={styles.modalOfferOriginalPrice}>{formatPrice(selectedOfferDetails.precio_original)}</Text>
                  <Text style={styles.modalOfferPromoPrice}>{formatPrice(selectedOfferDetails.precio_oferta)}</Text>
                  <View style={styles.modalOfferDiscountBadge}>
                    <Text style={styles.modalOfferDiscountText}>
                      -{Math.round(((selectedOfferDetails.precio_original - selectedOfferDetails.precio_oferta) / selectedOfferDetails.precio_original) * 100)}% OFF
                    </Text>
                  </View>
                </View>

                <View style={styles.modalDivider} />

                {/* Products inside the combo */}
                <Text style={styles.modalProductsTitle}>Productos incluidos en este combo:</Text>
                
                <View style={styles.modalProductsList}>
                  {(selectedOfferDetails.super_offer_items || []).map((it: any) => {
                    const product = it.products;
                    if (!product) return null;
                    return (
                      <View key={it.id} style={styles.modalProductRow}>
                        <View style={styles.modalProductImgContainer}>
                          {product.imagen ? (
                            <Image source={{ uri: product.imagen }} style={styles.modalProductImg} resizeMode="cover" />
                          ) : (
                            <MaterialCommunityIcons name={(CATEGORY_ICONS[product.categoria as ProductCategory] as any) || 'package-variant'} size={24} color={Colors.primary} />
                          )}
                        </View>
                        <View style={styles.modalProductTextContainer}>
                          <Text style={styles.modalProductName}>{product.nombre}</Text>
                          <Text style={styles.modalProductQty}>
                            Cantidad: {it.cantidad} {it.unidad} {product.presentacion ? `· ${product.presentacion}` : ''}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Bottom action bar */}
            <View style={styles.modalActionBar}>
              <TouchableOpacity
                style={styles.modalBuyButton}
                onPress={() => {
                  addOfferToCart(selectedOfferDetails);
                  setSelectedOfferDetails(null);
                }}
              >
                <MaterialCommunityIcons name="cart-plus" size={22} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.modalBuyButtonText}>Agregar Combo al Pedido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.huge,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  greeting: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  subGreeting: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  logoImage: {
    width: 48,
    height: 48,
  },

  // === SÚPER OFERTAS ===
  offersSection: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  offersTitleRow: {
    marginBottom: Spacing.md,
  },
  offersNeonTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FF1744',
    letterSpacing: 1,
    textShadowColor: 'rgba(255, 23, 68, 0.7)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  offersSubtitle: {
    fontSize: FontSize.sm,
    color: '#FF6B6B',
    fontWeight: FontWeight.semibold,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  offersScroll: {
    paddingRight: Spacing.lg,
    gap: Spacing.md,
  },
  offerCard: {
    width: 220,
    backgroundColor: '#1a0a0a',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: '#FF1744',
    shadowColor: '#FF1744',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  offerBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FF1744',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  offerBadgeText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  offerName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#fff',
    marginBottom: Spacing.xs,
    marginRight: 36,
  },
  offerDesc: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: Spacing.sm,
    lineHeight: 16,
  },
  offerItems: {
    marginBottom: Spacing.sm,
    gap: 2,
  },
  offerItem: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 17,
  },
  offerPrices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  offerOriginalPrice: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'line-through',
  },
  offerPromoPrice: {
    fontSize: FontSize.xxl,
    fontWeight: '900',
    color: '#FFD700',
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  offerBtn: {
    backgroundColor: '#FF1744',
    borderRadius: Radius.lg,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#FF1744',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  offerBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // === BANNERS PROMOCIONALES ===
  bannersSection: {
    marginTop: Spacing.lg,
    paddingLeft: Spacing.xl,
  },
  bannersScroll: {
    gap: Spacing.md,
    paddingRight: Spacing.xl,
  },
  bannerCard: {
    width: 300,
    height: 150,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  bannerTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#fff',
  },
  bannerSubtitle: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 2,
    lineHeight: 15,
  },

  // Banner de reparto
  deliveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.statusOnTheWay,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    shadowColor: Colors.statusOnTheWay,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  deliveryBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  deliveryBannerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryBannerText: {
    flex: 1,
  },
  deliveryBannerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  deliveryBannerSub: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 2,
  },
  deliveryBannerArrow: {
    paddingLeft: Spacing.md,
  },

  // Sección
  section: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  sectionLink: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },

  // Acciones rápidas
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  quickAction: {
    flex: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TouchTarget.xlarge,
    gap: Spacing.sm,
  },
  quickActionPrimary: {
    backgroundColor: Colors.primary,
    flex: 1.2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  quickActionSecondary: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  quickActionLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
  },
  quickActionLabelPrimary: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.white,
    textAlign: 'center',
  },

  // Tarjeta de repetir último pedido
  lastOrderCard: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#F8FAFC',
  },

  // Categorías
  categoriesList: {
    gap: Spacing.md,
  },
  categoryBannerCard: {
    height: 100,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryBannerBg: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  categoryBannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.45)', // dark elegant overlay
  },
  categoryBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    zIndex: 2,
  },
  categoryBannerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  categoryBannerText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#fff',
    marginLeft: Spacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Productos frecuentes en cuadrícula
  frequentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  frequentCardContainer: {
    width: '47%',
  },

  // Pedidos
  orderCard: {
    marginBottom: Spacing.md,
  },

  // Mosaicos Categorías Escritorio Web
  categoriesListDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  categoryBannerCardDesktop: {
    width: '23%', // 4 squares fit per row
    height: 140,
  },
  categoryBannerContentDesktop: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  categoryBannerTextDesktop: {
    marginLeft: 0,
    fontSize: FontSize.md,
    textAlign: 'center',
  },

  // Banners Promocionales Escritorio Web (Grande y del ancho de la página)
  bannersSectionDesktop: {
    height: 400,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    marginTop: 0,
    backgroundColor: '#0f172a',
  },
  bannersScrollDesktop: {
    flexGrow: 1,
  },
  bannerCardDesktop: {
    height: 400,
    position: 'relative',
    overflow: 'hidden',
  },
  bannerImageDesktop: {
    width: '100%',
    height: '100%',
  },
  bannerTitleDesktop: {
    fontSize: 28,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  bannerSubtitleDesktop: {
    fontSize: 18,
    fontWeight: FontWeight.semibold,
    color: '#FFD700', // Gold color text
    marginTop: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // ── Urgency & Custom Card Styles ──
  cardBadgesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  cardDiscountBadge: {
    backgroundColor: '#FF1744',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cardDiscountBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  cardUrgencyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardUrgencyText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '900',
    marginLeft: 3,
    letterSpacing: 0.5,
  },

  // ── Modal Styles ──
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)', // Dark translucent backdrop
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  modalContentDesktop: {
    maxWidth: 600,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 6,
  },
  modalScrollContent: {
    padding: 24,
    paddingTop: 48,
  },
  modalTextDetails: {
    flexDirection: 'column',
  },
  modalUrgencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF9C3', // Light warning yellow
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  modalUrgencyText: {
    color: '#854D0E', // Dark warning text
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  modalOfferName: {
    fontSize: 22,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  modalOfferDescText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  modalOfferPricesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalOfferOriginalPrice: {
    fontSize: 16,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  modalOfferPromoPrice: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: '#EF4444',
  },
  modalOfferDiscountBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  modalOfferDiscountText: {
    color: '#EF4444',
    fontWeight: FontWeight.bold,
    fontSize: 12,
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  modalProductsTitle: {
    fontSize: 16,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  modalProductsList: {
    gap: 12,
  },
  modalProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalProductImgContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  modalProductImg: {
    width: '100%',
    height: '100%',
  },
  modalProductTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  modalProductName: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  modalProductQty: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalActionBar: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
  },
  modalBuyButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBuyButtonText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    fontSize: 16,
  },
});
