import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Linking,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing, TouchTarget } from '../../constants/Spacing';
import { useOrderStore } from '../../store/orderStore';
import { useCatalogStore } from '../../store/catalogStore';
import { OrderCard } from '../../components/OrderCard';
import { OrderDetailModal } from '../../components/OrderDetailModal';
import { ProductCard } from '../../components/ProductCard';
import { useCartStore } from '../../store/cartStore';
import { getFirstName, formatPrice } from '../../utils/formatters';
import { useAuthStore } from '../../store/authStore';
import { CATEGORY_ICONS, CATEGORY_LABELS, ProductCategory, Product, Order } from '../../types';
import MaterialCommunityIcons from '../../components/icons/MaterialCommunityIcons';
import { useEntrance } from '../../hooks/useEntrance';
import { AppFooter } from '../../components/AppFooter';
import { HoverImagePreview } from '../../components/ui/HoverImagePreview';
import { AuthModal } from '../../components/modals/AuthModal';

const QUICK_CATEGORIES: ProductCategory[] = [
  'limpieza',
  'quimicos',
  'perfumeria',
  'descartables',
  'piscina',
  'industrial',
  'hogar',
  'institucional',
];

const DEFAULT_CATEGORY_IMAGES: Record<string, any> = {
  limpieza: require('../../assets/2.jpg'),
  quimicos: require('../../assets/1.webp'),
  perfumeria: require('../../assets/2.jpg'),
  descartables: require('../../assets/4.webp'),
  piscina: require('../../assets/3.jpeg'),
  industrial: require('../../assets/3.jpeg'),
  hogar: require('../../assets/banner.png'),
  institucional: require('../../assets/1.webp'),
};

const HERO_SLIDES = [
  {
    id: 'banner-3',
    image: require('../../assets/banner3.png'),
    link: '/(tabs)/catalogo',
  },
  {
    id: 'banner-1',
    image: require('../../assets/banner1.png'),
    link: '/(tabs)/catalogo',
  },
  {
    id: 'banner-2',
    image: require('../../assets/banner2.png'),
    link: '/(tabs)/catalogo',
  },
  {
    id: 'banner-4',
    image: require('../../assets/banner4.png'),
    link: '/(tabs)/mayoristas',
  },
];

const OFFER_CARD_COLORS = [
  '#0F172A', // Slate dark
  '#1E293B', // Slate medium
  '#1E3A8A', // Deep Blue
  '#064E3B', // Deep Green
  '#701A75', // Deep Fuchsia
  '#831843', // Deep Rose
];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const { repeatOrder, addProduct } = useCartStore();
  const { orders, activeDeliveryOrder, deliveredOrders, fetchOrders } = useOrderStore();
  const { isLoggedIn, clientData, userRole } = useAuthStore();
  const {
    products,
    fetchPaginatedProducts,
    fetchSuperOffers,
    superOffers,
    fetchBanners,
    banners,
    fetchCategoryBanners,
    categoryBanners,
    fetchCategoryNames,
    categoryNames,
    activeCategories,
  } = useCatalogStore();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [selectedOfferDetails, setSelectedOfferDetails] = useState<any | null>(null);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);
  const heroFadeAnim = useRef(new Animated.Value(1)).current;
  const heroTimerRef = useRef<any>(null);
  const isHovered = useRef(false);

  // Estado y referencias para el carrusel dinámico de Súper Ofertas
  const [activeOfferIndex, setActiveOfferIndex] = useState(0);
  const offersScrollRef = useRef<ScrollView>(null);
  const isOffersHovered = useRef(false);
  const offerCardWidth = isDesktop ? 400 : Math.min(340, width - 32);
  const offerCardStep = offerCardWidth + (isDesktop ? 20 : 12);

  // Animaciones de entrada escalonadas
  const heroAnim = useEntrance({ delay: 0, duration: 400 });
  const floatingBannerAnim = useEntrance({ delay: 80, duration: 400 });
  const categoriesAnim = useEntrance({ delay: 160, duration: 400 });
  const offersAnim = useEntrance({ delay: 210, duration: 400 });
  const productsAnim = useEntrance({ delay: 260, duration: 400 });
  const wholesaleAnim = useEntrance({ delay: 310, duration: 400 });

  const displayedCategories = useMemo(() => {
    if (activeCategories && activeCategories.length > 0) {
      return QUICK_CATEGORIES.filter((cat) => activeCategories.includes(cat));
    }
    return QUICK_CATEGORIES;
  }, [activeCategories]);

  useEffect(() => {
    if (isLoggedIn && userRole === 'repartidor') {
      router.replace('/(tabs)/reparto' as any);
      return;
    }

    fetchSuperOffers();
    fetchBanners();
    fetchCategoryBanners();
    fetchCategoryNames();
    fetchPaginatedProducts({ page: 1, pageSize: 20, sortBy: 'mas-vendido' });

    if (isLoggedIn && clientData) {
      fetchOrders(String(clientData.id));
    }
  }, [isLoggedIn, userRole, clientData]);

  // Auto-play Hero Carousel
  useEffect(() => {
    startHeroTimer();
    return () => stopHeroTimer();
  }, [heroIndex]);

  const startHeroTimer = () => {
    stopHeroTimer();
    heroTimerRef.current = setInterval(() => {
      if (!isHovered.current) {
        changeHeroSlide((heroIndex + 1) % HERO_SLIDES.length);
      }
    }, 6000);
  };

  const stopHeroTimer = () => {
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
  };

  const changeHeroSlide = (newIndex: number) => {
    Animated.timing(heroFadeAnim, {
      toValue: 0.15,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setHeroIndex(newIndex);
      Animated.timing(heroFadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });
  };

  const nextHeroSlide = () => {
    changeHeroSlide((heroIndex + 1) % HERO_SLIDES.length);
  };

  const prevHeroSlide = () => {
    changeHeroSlide((heroIndex - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  // Auto-play dinámico para el Carrusel de Súper Ofertas
  useEffect(() => {
    if (superOffers.length <= 1) return;
    const interval = setInterval(() => {
      if (!isOffersHovered.current) {
        setActiveOfferIndex((prev) => {
          const next = (prev + 1) % superOffers.length;
          offersScrollRef.current?.scrollTo({
            x: next * offerCardStep,
            animated: true,
          });
          return next;
        });
      }
    }, 4200);

    return () => clearInterval(interval);
  }, [superOffers.length, offerCardStep]);

  const scrollToOffer = (targetIndex: number) => {
    if (!superOffers || superOffers.length === 0) return;
    const boundedIndex = (targetIndex + superOffers.length) % superOffers.length;
    setActiveOfferIndex(boundedIndex);
    offersScrollRef.current?.scrollTo({
      x: boundedIndex * offerCardStep,
      animated: true,
    });
  };

  const handleNextOffer = () => {
    scrollToOffer(activeOfferIndex + 1);
  };

  const handlePrevOffer = () => {
    scrollToOffer(activeOfferIndex - 1);
  };

  const handleOffersScroll = (e: any) => {
    const x = e.nativeEvent?.contentOffset?.x || 0;
    const idx = Math.round(x / offerCardStep);
    if (idx >= 0 && idx < superOffers.length && idx !== activeOfferIndex) {
      setActiveOfferIndex(idx);
    }
  };

  const handleCategoryPress = (category: ProductCategory) => {
    router.push({
      pathname: '/(tabs)/catalogo',
      params: { categoria: category },
    } as any);
  };

  const handleRepeatOrder = (order: Order) => {
    repeatOrder(order);
    router.push('/(tabs)/carrito' as any);
  };

  const addOfferToCart = (offer: any) => {
    const items: any[] = offer.super_offer_items || [];
    if (items.length === 0) return;

    const totalOriginalComboPrice = items.reduce((sum: number, it: any) => {
      const p = it.products;
      const unitOrigPrice = p ? p.precio || 0 : 0;
      const qty = Math.max(1, Math.ceil(it.cantidad || 1));
      return sum + unitOrigPrice * qty;
    }, 0);

    const offerPrice = offer.precio_oferta || 0;

    items.forEach((it: any) => {
      if (it.products) {
        const qty = Math.max(1, Math.ceil(it.cantidad || 1));
        const unitOrigPrice = it.products.precio || 0;
        const itemOriginalTotal = unitOrigPrice * qty;

        let effectiveUnitPrice = 0;
        if (totalOriginalComboPrice > 0) {
          const itemEffectiveTotal = offerPrice * (itemOriginalTotal / totalOriginalComboPrice);
          effectiveUnitPrice = itemEffectiveTotal / qty;
        } else {
          const totalUnits = items.reduce((sum: number, i: any) => sum + Math.max(1, Math.ceil(i.cantidad || 1)), 0);
          effectiveUnitPrice = offerPrice / (totalUnits || 1);
        }

        addProduct({ ...it.products, precio: effectiveUnitPrice }, qty);
      }
    });
    router.push('/(tabs)/carrito' as any);
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent('Hola! Me gustaría consultar por lista de precios mayorista y condiciones de compra.');
    Linking.openURL(`https://wa.me/5493584123456?text=${text}`).catch(() => {});
  };

  const handleHomeSearch = () => {
    const trimmed = homeSearchQuery.trim();
    if (!trimmed) {
      router.push('/(tabs)/catalogo' as any);
      return;
    }
    router.push({
      pathname: '/(tabs)/catalogo',
      params: { search: trimmed },
    } as any);
  };

  const activeOrder = activeDeliveryOrder();
  const lastDelivered = deliveredOrders()[0];
  const activeSlide = HERO_SLIDES[heroIndex];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ======================================================== */}
        {/* BARRA AZUL DE BÚSQUEDA (Abajo del Menú Principal)         */}
        {/* "¿Qué estás buscando?" + Buscador "Buscar productos"     */}
        {/* ======================================================== */}
        <View style={styles.topSearchBarSection}>
          <View style={[styles.topSearchBarInner, isDesktop ? styles.topSearchBarInnerDesktop : styles.topSearchBarInnerMobile]}>
            <View style={styles.topSearchTitleWrap}>
              <MaterialCommunityIcons name="magnify" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.topSearchTitle}>¿Qué estás buscando?</Text>
            </View>

            <View style={[styles.topSearchInputContainer, isDesktop ? styles.topSearchInputContainerDesktop : styles.topSearchInputContainerMobile]}>
              <TextInput
                style={styles.topSearchInput}
                placeholder="Buscar productos..."
                placeholderTextColor="#94A3B8"
                value={homeSearchQuery}
                onChangeText={setHomeSearchQuery}
                onSubmitEditing={handleHomeSearch}
                returnKeyType="search"
              />
              {homeSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setHomeSearchQuery('')} style={styles.topSearchClearBtn} activeOpacity={0.7}>
                  <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.topSearchSubmitBtn}
                onPress={handleHomeSearch}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="magnify" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.topSearchSubmitBtnText}>Buscar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* HERO CAROUSEL: Portada de Banners Oficiales en Carrusel  */}
        {/* ======================================================== */}
        <Animated.View style={[styles.heroSection, heroAnim.animatedStyle]}>
          <TouchableOpacity
            style={[styles.heroCard, isDesktop && styles.heroCardDesktop]}
            activeOpacity={0.96}
            onPress={() => {
              if (activeSlide.link) {
                router.push(activeSlide.link as any);
              } else {
                router.push('/(tabs)/catalogo' as any);
              }
            }}
            // @ts-ignore
            onMouseEnter={() => { isHovered.current = true; }}
            onMouseLeave={() => { isHovered.current = false; }}
          >
            {/* Imagen de Banner Oficial en Pantalla Completa Animada con Fade */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: heroFadeAnim }]}>
              <Image source={activeSlide.image} style={styles.heroBgImage} resizeMode="cover" />
            </Animated.View>

            {/* Flechas de Navegación Lateral */}
            <TouchableOpacity
              style={[styles.heroArrowBtn, styles.heroArrowLeft, !isDesktop && styles.heroArrowBtnMobile]}
              onPress={(e) => {
                e.stopPropagation?.();
                prevHeroSlide();
              }}
              activeOpacity={0.8}
              accessibilityLabel="Banner anterior"
            >
              <MaterialCommunityIcons name="chevron-left" size={isDesktop ? 28 : 20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.heroArrowBtn, styles.heroArrowRight, !isDesktop && styles.heroArrowBtnMobile]}
              onPress={(e) => {
                e.stopPropagation?.();
                nextHeroSlide();
              }}
              activeOpacity={0.8}
              accessibilityLabel="Siguiente banner"
            >
              <MaterialCommunityIcons name="chevron-right" size={isDesktop ? 28 : 20} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Puntos Indicadores Inferiores */}
            <View style={styles.heroDotsContainer}>
              {HERO_SLIDES.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    changeHeroSlide(idx);
                  }}
                  style={[styles.heroDot, heroIndex === idx && styles.heroDotActive]}
                  activeOpacity={0.8}
                  accessibilityLabel={`Ir a banner ${idx + 1}`}
                />
              ))}
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ======================================================== */}
        {/* SI ESTÁ LOGUEADO: Banner de Bienvenida y Acciones Rápidas */}
        {/* ======================================================== */}
        {isLoggedIn && (
          <View style={styles.loggedUserSection}>
            <View style={styles.loggedHeaderRow}>
              <View>
                <Text style={styles.loggedGreeting}>¡Hola, {getFirstName(clientData?.nombre || 'Cliente')}! 👋</Text>
                <Text style={styles.loggedSubtitle}>Bienvenido a tu panel de pedidos</Text>
              </View>
              {lastDelivered && (
                <TouchableOpacity
                  style={styles.repeatOrderBtn}
                  onPress={() => handleRepeatOrder(lastDelivered)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="refresh" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.repeatOrderBtnText}>Repetir último pedido</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Banner de Reparto Activo en Camino */}
            {activeOrder && (
              <TouchableOpacity
                style={styles.deliveryActiveBanner}
                onPress={() => router.push('/(tabs)/reparto' as any)}
                activeOpacity={0.85}
              >
                <View style={styles.deliveryActiveIconWrap}>
                  <MaterialCommunityIcons name="truck-delivery" size={24} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deliveryActiveTitle}>Tu pedido está en camino</Text>
                  <Text style={styles.deliveryActiveSub}>
                    Pedido #{activeOrder.numero} · {activeOrder.estado === 'en_camino' ? 'En reparto hoy' : 'En preparación'}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* SI NO ESTÁ LOGUEADO: Banner de Bienvenida y Acceso Rápido */}
        {/* ======================================================== */}
        {!isLoggedIn && (
          <View style={styles.guestBannerSection}>
            <View style={[styles.guestBannerCard, isDesktop ? styles.guestBannerCardDesktop : styles.guestBannerCardMobile]}>
              <View style={styles.guestBannerContent}>
                <View style={styles.guestBadge}>
                  <MaterialCommunityIcons name="shield-check" size={15} color="#1D4ED8" />
                  <Text style={styles.guestBadgeText}>VENTA OFICIAL DIRECTA DE FÁBRICA</Text>
                </View>
                <Text style={styles.guestBannerTitle}>
                  ¡Comprá online con los mejores precios minoristas y mayoristas!
                </Text>
                <Text style={styles.guestBannerSubtitle}>
                  Iniciá sesión o registrate para gestionar tus compras, guardar tus domicilios de entrega y seguir tus envíos en tiempo real con chofer asignado.
                </Text>
              </View>

              <View style={[styles.guestBannerActions, isDesktop ? styles.guestBannerActionsDesktop : styles.guestBannerActionsMobile]}>
                <TouchableOpacity
                  style={styles.guestLoginBtn}
                  onPress={() => setShowAuthModal(true)}
                  activeOpacity={0.88}
                >
                  <MaterialCommunityIcons name="login" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.guestLoginBtnText}>Iniciar Sesión</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.guestRegisterBtn}
                  onPress={() => setShowAuthModal(true)}
                  activeOpacity={0.88}
                >
                  <MaterialCommunityIcons name="account-plus-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.guestRegisterBtnText}>Crear Cuenta</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* BANNER DESTACADO: TARJETAS FLOTANTES CON SOMBRA           */}
        {/* Envíos 24hs | Ventas Mayoristas | Promociones Únicas       */}
        {/* ======================================================== */}
        <Animated.View style={[styles.floatingBannerSection, floatingBannerAnim.animatedStyle]}>
          <View style={[styles.floatingCardsRow, isDesktop ? styles.floatingCardsRowDesktop : styles.floatingCardsRowMobile]}>
            {/* Tarjeta 1: Envíos Locales 24hs */}
            <TouchableOpacity
              style={styles.floatingCard}
              activeOpacity={0.88}
              onPress={() => router.push('/(tabs)/catalogo' as any)}
            >
              <View style={[styles.floatingCardAccentBar, { backgroundColor: '#1A56DB' }]} />
              <View style={styles.floatingCardHeader}>
                <View style={[styles.floatingIconBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <MaterialCommunityIcons name="truck-fast" size={26} color="#1A56DB" />
                </View>
                <View style={[styles.floatingTag, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[styles.floatingTagText, { color: '#1A56DB' }]}>LOGÍSTICA PROPIA</Text>
                </View>
              </View>

              <Text style={styles.floatingCardTitle}>ENVÍOS LOCALES EN 24 HS</Text>
              <Text style={styles.floatingCardSubtitle}>General Deheza y zona</Text>

              <View style={styles.floatingCardFooter}>
                <Text style={[styles.floatingCardLink, { color: '#1A56DB' }]}>Ver catálogo con entrega 24hs</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color="#1A56DB" />
              </View>
            </TouchableOpacity>

            {/* Tarjeta 2: Ventas Mayoristas */}
            <TouchableOpacity
              style={styles.floatingCard}
              activeOpacity={0.88}
              onPress={() => router.push('/(tabs)/mayoristas' as any)}
            >
              <View style={[styles.floatingCardAccentBar, { backgroundColor: '#1A56DB' }]} />
              <View style={styles.floatingCardHeader}>
                <View style={[styles.floatingIconBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <MaterialCommunityIcons name="storefront-outline" size={26} color="#1A56DB" />
                </View>
                <View style={[styles.floatingTag, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[styles.floatingTagText, { color: '#1A56DB' }]}>PORTAL B2B</Text>
                </View>
              </View>

              <Text style={styles.floatingCardTitle}>VENTAS MAYORISTAS</Text>
              <Text style={styles.floatingCardSubtitle}>Ingresá a nuestro portal MAYORISTA y completá el formulario</Text>

              <View style={styles.floatingCardFooter}>
                <Text style={[styles.floatingCardLink, { color: '#1A56DB' }]}>Completar formulario de admisión</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color="#1A56DB" />
              </View>
            </TouchableOpacity>

            {/* Tarjeta 3: Promociones Únicas */}
            <TouchableOpacity
              style={styles.floatingCard}
              activeOpacity={0.88}
              onPress={() => router.push({ pathname: '/(tabs)/catalogo', params: { sort: 'ofertas' } } as any)}
            >
              <View style={[styles.floatingCardAccentBar, { backgroundColor: '#1A56DB' }]} />
              <View style={styles.floatingCardHeader}>
                <View style={[styles.floatingIconBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <MaterialCommunityIcons name="tag-multiple" size={26} color="#1A56DB" />
                </View>
                <View style={[styles.floatingTag, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[styles.floatingTagText, { color: '#1A56DB' }]}>COMBOS Y AHORRO</Text>
                </View>
              </View>

              <Text style={styles.floatingCardTitle}>PROMOCIONES ÚNICAS</Text>
              <Text style={styles.floatingCardSubtitle}>Los mejores combos para que ahorres</Text>

              <View style={styles.floatingCardFooter}>
                <Text style={[styles.floatingCardLink, { color: '#1A56DB' }]}>Explorar combos con descuento</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color="#1A56DB" />
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ======================================================== */}
        {/* SECCIONES / CATEGORÍAS DESTACADAS                         */}
        {/* ======================================================== */}
        <Animated.View style={[styles.section, categoriesAnim.animatedStyle]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>RUBROS PRINCIPALES</Text>
              </View>
              <Text style={styles.sectionTitle}>Nuestras Secciones</Text>
              <Text style={styles.sectionSubtitle}>Explorá nuestro catálogo organizado por rubro</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/catalogo' as any)} activeOpacity={0.7}>
              <Text style={styles.sectionLink}>Ver catálogo completo →</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.categoriesGrid, isDesktop && styles.categoriesGridDesktop]}>
            {displayedCategories.map((cat) => {
              const bannerUrl = categoryBanners[cat] || '';
              const imageSource = bannerUrl ? { uri: bannerUrl } : (DEFAULT_CATEGORY_IMAGES[cat] || require('../../assets/banner.png'));
              const label = categoryNames[cat] || CATEGORY_LABELS[cat];
              const icon = CATEGORY_ICONS[cat] || 'package-variant';

              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryCard, isDesktop ? styles.categoryCardDesktop : styles.categoryCardMobile]}
                  onPress={() => handleCategoryPress(cat)}
                  activeOpacity={0.85}
                >
                  <Image source={imageSource} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  <View style={styles.categoryCardOverlay} />
                  <View style={styles.categoryCardContent}>
                    <View style={styles.categoryIconWrap}>
                      <MaterialCommunityIcons name={icon as any} size={20} color="#FFFFFF" />
                    </View>
                    <Text style={styles.categoryCardLabel}>{label}</Text>
                    <MaterialCommunityIcons name="arrow-right" size={16} color="#94A3B8" />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* ======================================================== */}
        {/* ======================================================== */}
        {/* SÚPER OFERTAS & COMBOS PROMOCIONALES - CARRUSEL DINÁMICO */}
        {/* ======================================================== */}
        {superOffers.length > 0 && (
          <Animated.View style={[styles.offersSection, offersAnim.animatedStyle]}>
            <View style={[styles.offersHeaderRow, !isDesktop && styles.offersHeaderRowMobile]}>
              <View style={{ flex: 1, paddingRight: isDesktop ? 12 : 0 }}>
                <View style={styles.offersSectionBadge}>
                  <MaterialCommunityIcons name="lightning-bolt" size={13} color="#EA580C" />
                  <Text style={styles.offersSectionBadgeText}>AHORRÁ HOY</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <Text style={[styles.offersSectionTitle, !isDesktop && { fontSize: 18 }]}>Súper Ofertas & Combos</Text>
                  <View style={styles.limitedBadge}>
                    <Text style={styles.limitedBadgeText}>TIEMPO LIMITADO</Text>
                  </View>
                </View>
                <Text style={styles.offersSectionSub}>Aprovechá bultos cerrados y combos promocionales con precio especial</Text>
              </View>

              {/* Controles interactivos del Carrusel */}
              <View style={[styles.offersHeaderNavGroup, !isDesktop && styles.offersHeaderNavGroupMobile]}>
                <TouchableOpacity
                  onPress={handlePrevOffer}
                  style={styles.carouselNavArrowBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Oferta anterior"
                >
                  <MaterialCommunityIcons name="chevron-left" size={20} color="#1E293B" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNextOffer}
                  style={styles.carouselNavArrowBtn}
                  activeOpacity={0.7}
                  accessibilityLabel="Siguiente oferta"
                >
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#1E293B" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/catalogo' as any)}
                  activeOpacity={0.7}
                  style={styles.offersHeaderLinkBtn}
                >
                  <Text style={styles.offersSectionLink}>Ver todas →</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Contenedor del Carrusel con soporte de pausa al pasar el mouse en Web */}
            <View
              // @ts-ignore
              onMouseEnter={() => { isOffersHovered.current = true; }}
              // @ts-ignore
              onMouseLeave={() => { isOffersHovered.current = false; }}
              style={styles.offersCarouselWrapper}
            >
              <ScrollView
                ref={offersScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.offersScroll}
                onScroll={handleOffersScroll}
                scrollEventThrottle={16}
                decelerationRate="fast"
                snapToInterval={offerCardStep}
                snapToAlignment="start"
              >
                {superOffers.map((offer: any, index: number) => {
                  const discount = offer.precio_original > 0
                    ? Math.round(((offer.precio_original - offer.precio_oferta) / offer.precio_original) * 100)
                    : 0;
                  const savings = offer.precio_original > offer.precio_oferta
                    ? offer.precio_original - offer.precio_oferta
                    : 0;
                  const items: any[] = offer.super_offer_items || [];
                  const cardColor = OFFER_CARD_COLORS[index % OFFER_CARD_COLORS.length];

                  // Extraer fotos de los productos del combo
                  const itemImages = items
                    .map((it: any) => it.products?.imagen)
                    .filter((img: string | undefined) => !!img);
                  const mainImage = offer.imagen || itemImages[0];

                  return (
                    <TouchableOpacity
                      key={offer.id}
                      style={[styles.offerCard, { width: offerCardWidth, backgroundColor: cardColor }]}
                      onPress={() => setSelectedOfferDetails(offer)}
                      activeOpacity={0.92}
                      // @ts-ignore
                      className="super-offer-card-zoom"
                    >
                      {/* Fila superior de Badges (Descuento, Combo Especial y Ahorro) */}
                      <View style={styles.offerBadgeRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {discount > 0 && (
                            <View style={styles.offerDiscountBadge}>
                              <Text style={styles.offerDiscountBadgeText}>-{discount}% OFF</Text>
                            </View>
                          )}
                          <View style={styles.offerFlashBadge}>
                            <MaterialCommunityIcons name="flash" size={13} color="#FBBF24" />
                            <Text style={styles.offerFlashText}>COMBO ESPECIAL</Text>
                          </View>
                        </View>
                        {savings > 0 && (
                          <View style={styles.offerSavingsPill}>
                            <Text style={styles.offerSavingsPillText}>Ahorrás {formatPrice(savings)}</Text>
                          </View>
                        )}
                      </View>

                      {/* Escaparate visual ampliado de Fotos con efecto zoom in */}
                      <View style={styles.offerImageShowcase}>
                        {mainImage ? (
                          <View style={styles.offerImageWrap}>
                            <Image
                              source={{ uri: mainImage }}
                              style={styles.offerMainImage}
                              resizeMode="contain"
                              // @ts-ignore
                              className="super-offer-img-zoom"
                            />
                          </View>
                        ) : (
                          <View style={styles.offerPlaceholderWrap}>
                            <MaterialCommunityIcons name="package-variant-closed" size={56} color="#94A3B8" />
                            <Text style={styles.offerPlaceholderText}>Combo de Productos Especial</Text>
                          </View>
                        )}

                        {/* Miniaturas grandes de productos si el combo contiene varios artículos */}
                        {itemImages.length > 1 && (
                          <View style={styles.offerThumbnailsRow}>
                            {itemImages.slice(0, 5).map((thumbUri: string, thumbIdx: number) => (
                              <View key={thumbIdx} style={styles.offerThumbWrap}>
                                <Image source={{ uri: thumbUri }} style={styles.offerThumbImg} resizeMode="contain" />
                              </View>
                            ))}
                            {itemImages.length > 5 && (
                              <View style={styles.offerThumbMore}>
                                <Text style={styles.offerThumbMoreText}>+{itemImages.length - 5}</Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>

                      <Text style={styles.offerCardName} numberOfLines={2}>{offer.nombre}</Text>

                      {items.length > 0 && (
                        <View style={styles.offerItemsList}>
                          {items.slice(0, 3).map((it: any) => (
                            <View key={it.id} style={styles.offerItemRow}>
                              <MaterialCommunityIcons name="check-circle" size={15} color="#10B981" style={{ marginRight: 6 }} />
                              <Text style={styles.offerItemLine} numberOfLines={1}>
                                <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>{it.cantidad} {it.unidad}</Text> {it.products?.nombre || ''}
                              </Text>
                            </View>
                          ))}
                          {items.length > 3 && (
                            <Text style={styles.offerItemMore}>+ {items.length - 3} productos más en este combo</Text>
                          )}
                        </View>
                      )}

                      <View style={styles.offerPricesRow}>
                        {offer.precio_original > 0 && (
                          <View>
                            <Text style={styles.offerOriginalPriceLabel}>Normal</Text>
                            <Text style={styles.offerOriginalPrice}>{formatPrice(offer.precio_original)}</Text>
                          </View>
                        )}
                        <View>
                          <Text style={styles.offerPromoPriceLabel}>Precio Oferta</Text>
                          <Text style={styles.offerPromoPrice}>{formatPrice(offer.precio_oferta)}</Text>
                        </View>
                      </View>

                      <View style={styles.offerActionBtn}>
                        <MaterialCommunityIcons name="cart-plus" size={18} color={cardColor} style={{ marginRight: 6 }} />
                        <Text style={[styles.offerActionBtnText, { color: cardColor }]}>Ver Combo & Agregar</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Indicadores de posición (Dots) del Carrusel */}
              {superOffers.length > 1 && (
                <View style={styles.offersDotsContainer}>
                  {superOffers.map((_: any, dotIdx: number) => {
                    const isActive = dotIdx === activeOfferIndex;
                    return (
                      <TouchableOpacity
                        key={dotIdx}
                        onPress={() => scrollToOffer(dotIdx)}
                        style={[
                          styles.offerDot,
                          isActive ? styles.offerDotActive : styles.offerDotInactive,
                        ]}
                        activeOpacity={0.8}
                        accessibilityLabel={`Ir a oferta ${dotIdx + 1}`}
                      />
                    );
                  })}
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* ======================================================== */}
        {/* PRODUCTOS DESTACADOS: Grid de Artículos Populares        */}
        {/* ======================================================== */}
        <Animated.View style={[styles.section, productsAnim.animatedStyle]}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>LO MÁS PEDIDO</Text>
              </View>
              <Text style={styles.sectionTitle}>Productos Destacados</Text>
              <Text style={styles.sectionSubtitle}>Los artículos más elegidos por nuestros clientes</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/catalogo' as any)} activeOpacity={0.7}>
              <Text style={styles.sectionLink}>Ver catálogo →</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.productsGrid, isDesktop && styles.productsGridDesktop]}>
            {products.slice(0, isDesktop ? 20 : 10).map((product, index) => (
              <View key={product.id} style={[styles.productCardCol, isDesktop ? styles.productCardColDesktop : styles.productCardColMobile]}>
                <ProductCard product={product} delay={index * 40} />
              </View>
            ))}
          </View>

          <View style={styles.catalogCtaBox}>
            <TouchableOpacity
              style={styles.catalogCtaBtn}
              onPress={() => router.push('/(tabs)/catalogo' as any)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="view-grid" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.catalogCtaBtnText}>Ver todos los productos del catálogo</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ======================================================== */}
        {/* BANNER MAYORISTA & ADMISIÓN DE COMERCIOS                 */}
        {/* ======================================================== */}
        <Animated.View style={[styles.wholesaleSection, wholesaleAnim.animatedStyle]}>
          <View style={[styles.wholesaleCard, isDesktop && styles.wholesaleCardDesktop]}>
            <View style={styles.wholesaleTextCol}>
              <View style={styles.wholesaleBadge}>
                <MaterialCommunityIcons name="briefcase-outline" size={14} color="#1E40AF" style={{ marginRight: 6 }} />
                <Text style={styles.wholesaleBadgeText}>ATENCIÓN COMERCIAL & EMPRESAS</Text>
              </View>
              <Text style={styles.wholesaleTitle}>¿Comprás por mayor o tenés comercio?</Text>
              <Text style={styles.wholesaleSubtitle}>
                Accedé a listas de precios diferenciales por volumen, bultos cerrados y bonificaciones en repartos para General Deheza y zona.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.wholesaleBtn}
              onPress={() => router.push('/(tabs)/mayoristas' as any)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="file-document-edit-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.wholesaleBtnText}>Completar Formulario Mayorista</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ======================================================== */}
        {/* FOOTER TRADICIONAL                                       */}
        {/* ======================================================== */}
        <AppFooter />
      </ScrollView>

      {/* ── Modal Detalle de Oferta Combo ── */}
      {selectedOfferDetails && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedOfferDetails(null)}>
              <MaterialCommunityIcons name="close" size={22} color="#64748B" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.modalUrgencyRow}>
                <MaterialCommunityIcons name="flash" size={16} color="#EAB308" />
                <Text style={styles.modalUrgencyText}>🔥 SÚPER OFERTA · COMBO ESPECIAL</Text>
              </View>

              <Text style={styles.modalOfferName}>{selectedOfferDetails.nombre}</Text>

              {selectedOfferDetails.descripcion ? (
                <Text style={styles.modalOfferDescText}>{selectedOfferDetails.descripcion}</Text>
              ) : (
                <Text style={styles.modalOfferDescText}>Selección especial de artículos directo de fábrica.</Text>
              )}

              <View style={styles.modalOfferPricesRow}>
                {selectedOfferDetails.precio_original > 0 && (
                  <Text style={styles.modalOfferOriginalPrice}>{formatPrice(selectedOfferDetails.precio_original)}</Text>
                )}
                <Text style={styles.modalOfferPromoPrice}>{formatPrice(selectedOfferDetails.precio_oferta)}</Text>
                {selectedOfferDetails.precio_original > 0 && (
                  <View style={styles.modalOfferDiscountBadge}>
                    <Text style={styles.modalOfferDiscountText}>
                      -{Math.round(((selectedOfferDetails.precio_original - selectedOfferDetails.precio_oferta) / selectedOfferDetails.precio_original) * 100)}% OFF
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.modalDivider} />

              <Text style={styles.modalProductsTitle}>Productos incluidos en este combo:</Text>
              <View style={styles.modalProductsList}>
                {(selectedOfferDetails.super_offer_items || []).map((it: any) => {
                  const prod = it.products;
                  if (!prod) return null;
                  return (
                    <View key={it.id} style={styles.modalProductRow}>
                      <View style={styles.modalProductImgWrap}>
                        {prod.imagen ? (
                          <HoverImagePreview
                            imageUri={prod.imagen}
                            name={prod.nombre}
                            price={prod.precio}
                            presentation={prod.presentacion}
                            codigo={prod.codigo}
                          >
                            <Image source={{ uri: prod.imagen }} style={styles.modalProductImg} resizeMode="contain" />
                          </HoverImagePreview>
                        ) : (
                          <MaterialCommunityIcons name={(CATEGORY_ICONS[prod.categoria as ProductCategory] as any) || 'package-variant'} size={24} color={Colors.primary} />
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalProductName}>{prod.nombre}</Text>
                        <Text style={styles.modalProductQty}>
                          Cantidad: {it.cantidad} {it.unidad} {prod.presentacion ? `· ${prod.presentacion}` : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.modalActionBar}>
              <TouchableOpacity
                style={styles.modalBuyButton}
                onPress={() => {
                  addOfferToCart(selectedOfferDetails);
                  setSelectedOfferDetails(null);
                }}
              >
                <MaterialCommunityIcons name="cart-plus" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.modalBuyButtonText}>Agregar Combo al Pedido</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal de Detalle de Pedido */}
      <OrderDetailModal
        order={selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
        onRepeat={handleRepeatOrder}
      />

      {/* Modal de Autenticación para Invitados */}
      <AuthModal visible={showAuthModal} onClose={() => setShowAuthModal(false)} />

      {/* Inyección de CSS para efecto zoom in de las súper ofertas en Web */}
      {Platform.OS === 'web' && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
            .super-offer-card-zoom {
              transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, border-color 0.35s ease !important;
              will-change: transform, box-shadow;
            }
            .super-offer-card-zoom:hover {
              transform: translateY(-8px) scale(1.03) !important;
              box-shadow: 0 26px 50px -8px rgba(15, 23, 42, 0.42), 0 14px 24px -4px rgba(0, 0, 0, 0.25) !important;
              border-color: #FBBF24 !important;
              z-index: 25;
            }
            .super-offer-img-zoom {
              transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) !important;
            }
            .super-offer-card-zoom:hover .super-offer-img-zoom {
              transform: scale(1.09) !important;
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
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.huge,
  },

  // ========================================================
  // BARRA AZUL DE BÚSQUEDA DEL INICIO
  // ========================================================
  topSearchBarSection: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#1746B3',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 14px -2px rgba(26, 86, 219, 0.28)',
    } : {}),
  },
  topSearchBarInner: {
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
    gap: 12,
  },
  topSearchBarInnerDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  topSearchBarInnerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  topSearchTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topSearchTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  topSearchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    overflow: 'hidden',
    height: 44,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.08)',
    } : {}),
  },
  topSearchInputContainerDesktop: {
    flex: 1,
    maxWidth: 580,
  },
  topSearchInputContainerMobile: {
    width: '100%',
  },
  topSearchInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 14,
    paddingVertical: 0,
    fontSize: FontSize.sm,
    color: '#0F172A',
    ...(Platform.OS === 'web' ? {
      outlineStyle: 'none' as any,
    } : {}),
  },
  topSearchClearBtn: {
    paddingHorizontal: 8,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topSearchSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 18,
    height: '100%',
    justifyContent: 'center',
  },
  topSearchSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.4,
  },

  // ========================================================
  // HERO CAROUSEL
  // ========================================================
  heroSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  heroCard: {
    width: '100%',
    aspectRatio: 1774 / 887,
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.12)',
      cursor: 'pointer',
    } : {}),
  },
  heroCardDesktop: {},
  heroBgImage: {
    width: '100%',
    height: '100%',
  },
  heroArrowBtn: {
    position: 'absolute',
    top: '46%',
    width: 44,
    height: 44,
    borderRadius: Radius.xs,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } : {}),
  },
  heroArrowBtnMobile: {
    width: 30,
    height: 30,
    borderRadius: 6,
  },
  heroArrowLeft: {
    left: 8,
  },
  heroArrowRight: {
    right: 8,
  },
  heroDotsContainer: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  heroDotActive: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },

  // ========================================================
  // LOGGED USER BAR
  // ========================================================
  loggedUserSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: 12,
  },
  loggedHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 12,
  },
  loggedGreeting: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  loggedSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  repeatOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.xs,
  },
  repeatOrderBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  deliveryActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.primary,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  deliveryActiveIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryActiveTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
  },
  deliveryActiveSub: {
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },

  // ========================================================
  // BANNER DE BIENVENIDA PARA USUARIOS NO LOGUEADOS
  // ========================================================
  guestBannerSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  guestBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: Spacing.lg,
    gap: 16,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 14px -2px rgba(30, 58, 138, 0.08)',
    } : {}),
  },
  guestBannerCardDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  guestBannerCardMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 16,
  },
  guestBannerContent: {
    flex: 1,
    gap: 6,
  },
  guestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
    gap: 5,
    marginBottom: 2,
  },
  guestBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#1D4ED8',
    letterSpacing: 0.5,
  },
  guestBannerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#0F172A',
    lineHeight: 22,
  },
  guestBannerSubtitle: {
    fontSize: FontSize.xs,
    color: '#64748B',
    lineHeight: 18,
    maxWidth: 680,
  },
  guestBannerActions: {
    gap: 10,
  },
  guestBannerActionsDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  guestBannerActionsMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 4,
  },
  guestLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: Radius.xs,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
    flex: 1,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
  guestLoginBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  guestRegisterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9.5,
    borderRadius: Radius.xs,
    flex: 1,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
  guestRegisterBtnText: {
    color: Colors.primary,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },

  // ========================================================
  // BANNER DE TARJETAS FLOTANTES CON SOMBRA
  // ========================================================
  floatingBannerSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  floatingCardsRow: {
    gap: 14,
  },
  floatingCardsRowDesktop: {
    flexDirection: 'row',
  },
  floatingCardsRowMobile: {
    flexDirection: 'column',
  },
  floatingCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.lg,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.10), 0 4px 8px -2px rgba(15, 23, 42, 0.04)',
      cursor: 'pointer',
    } : {}),
  },
  floatingCardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  floatingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  floatingIconBadge: {
    width: 48,
    height: 48,
    borderRadius: Radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  floatingTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  floatingTagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  floatingCardTitle: {
    fontSize: FontSize.md,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  floatingCardSubtitle: {
    fontSize: FontSize.sm,
    color: '#475569',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  floatingCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  floatingCardLink: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },

  // ========================================================
  // SECCIONES / CATEGORÍAS
  // ========================================================
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  sectionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    marginBottom: 4,
  },
  sectionBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionLink: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoriesGridDesktop: {
    gap: 14,
  },
  categoryCard: {
    height: 110,
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 12px -2px rgba(15, 23, 42, 0.08)',
      cursor: 'pointer',
    } : {}),
  },
  categoryCardMobile: {
    width: Platform.OS === 'web' ? ('calc(50% - 6px)' as any) : '48%',
    height: 90,
  },
  categoryCardDesktop: {
    width: '23.4%',
  },
  categoryCardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  categoryCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
    gap: 6,
    zIndex: 2,
  },
  categoryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: Radius.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryCardLabel: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // ========================================================
  // SÚPER OFERTAS & COMBOS
  // ========================================================
  offersSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  offersHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  offersHeaderRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  offersHeaderNavGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offersHeaderNavGroupMobile: {
    alignSelf: 'flex-end',
  },
  carouselNavArrowBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
  offersHeaderLinkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.xs,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginLeft: 4,
  },
  offersSectionBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    marginBottom: 4,
  },
  offersSectionBadgeText: {
    color: '#EA580C',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  offersSectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  offersSectionSub: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  offersSectionLink: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#DC2626',
  },
  limitedBadge: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  limitedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  offersCarouselWrapper: {
    position: 'relative',
  },
  offersScroll: {
    gap: 20,
    paddingRight: Spacing.xl,
    paddingTop: 12,
    paddingBottom: 16,
  },
  offersDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingVertical: 6,
  },
  offerDot: {
    height: 8,
    borderRadius: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  offerDotActive: {
    width: 28,
    backgroundColor: '#DC2626',
  },
  offerDotInactive: {
    width: 8,
    backgroundColor: '#CBD5E1',
  },
  offerCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 8,
    position: 'relative',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.25)',
      cursor: 'pointer',
    } : {}),
  },
  offerBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  offerDiscountBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  offerDiscountBadgeText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '900',
  },
  offerFlashBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
    gap: 4,
  },
  offerFlashText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  offerSavingsPill: {
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    borderWidth: 1,
    borderColor: '#FBBF24',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  offerSavingsPillText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '800',
  },
  offerImageShowcase: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  offerImageWrap: {
    width: '100%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  offerMainImage: {
    width: '100%',
    height: 210,
  },
  offerPlaceholderWrap: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.sm,
    gap: 8,
  },
  offerPlaceholderText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
  },
  offerThumbnailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    width: '100%',
    justifyContent: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  offerThumbWrap: {
    width: 46,
    height: 46,
    borderRadius: Radius.xs,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  offerThumbImg: {
    width: '100%',
    height: '100%',
  },
  offerThumbMore: {
    width: 46,
    height: 46,
    borderRadius: Radius.xs,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerThumbMoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1A56DB',
  },
  offerCardName: {
    fontSize: 18,
    fontWeight: FontWeight.bold,
    color: '#FFFFFF',
    marginBottom: Spacing.sm,
    lineHeight: 24,
  },
  offerItemsList: {
    marginBottom: Spacing.md,
    gap: 4,
  },
  offerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offerItemLine: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  offerItemMore: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
    marginTop: 2,
  },
  offerPricesRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    marginBottom: Spacing.md,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  offerOriginalPriceLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
    marginBottom: 1,
  },
  offerOriginalPrice: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textDecorationLine: 'line-through',
  },
  offerPromoPriceLabel: {
    fontSize: 11,
    color: '#FBBF24',
    fontWeight: '700',
    marginBottom: 1,
  },
  offerPromoPrice: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FBBF24',
    lineHeight: 30,
  },
  offerActionBtn: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: Radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
  offerActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ========================================================
  // PRODUCTOS DESTACADOS
  // ========================================================
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  productsGridDesktop: {
    gap: 16,
  },
  productCardCol: {
    minHeight: 280,
  },
  productCardColMobile: {
    width: Platform.OS === 'web' ? ('calc(50% - 6px)' as any) : '48%',
  },
  productCardColDesktop: {
    width: Platform.OS === 'web' ? ('calc(25% - 12px)' as any) : '23.6%',
  },
  catalogCtaBox: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  catalogCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Radius.xs,
  },
  catalogCtaBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // ========================================================
  // WHOLESALE CALLOUT
  // ========================================================
  wholesaleSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  wholesaleCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: Radius.md,
    padding: Spacing.xl,
    flexDirection: 'column',
    gap: Spacing.md,
  },
  wholesaleCardDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wholesaleTextCol: {
    flex: 1,
    gap: 6,
  },
  wholesaleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  wholesaleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E40AF',
    letterSpacing: 0.5,
  },
  wholesaleTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  wholesaleSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    maxWidth: 620,
  },
  wholesaleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A56DB',
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: Radius.xs,
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    ...(Platform.OS === 'web' ? {
      cursor: 'pointer',
    } : {}),
  },
  wholesaleBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
  },

  // ========================================================
  // MODAL COMBO OFERTA
  // ========================================================
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    width: '92%',
    maxHeight: '85%',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalContentDesktop: {
    width: 580,
    maxHeight: '80%',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.xs,
    padding: 6,
  },
  modalScrollContent: {
    padding: Spacing.xl,
  },
  modalUrgencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  modalUrgencyText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  modalOfferName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  modalOfferDescText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  modalOfferPricesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.lg,
  },
  modalOfferOriginalPrice: {
    fontSize: FontSize.md,
    color: Colors.textDisabled,
    textDecorationLine: 'line-through',
  },
  modalOfferPromoPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.primary,
  },
  modalOfferDiscountBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.xs,
  },
  modalOfferDiscountText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontWeight: '800',
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: Spacing.md,
  },
  modalProductsTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalProductsList: {
    gap: 10,
  },
  modalProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.sm,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalProductImgWrap: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalProductImg: {
    width: '100%',
    height: '100%',
  },
  modalProductName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  modalProductQty: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalActionBar: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  modalBuyButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBuyButtonText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
