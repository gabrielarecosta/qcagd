import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  SafeAreaView,
  Platform,
  useWindowDimensions,
  Modal,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '../../components/icons/MaterialCommunityIcons';
import { Colors } from '../../constants/Colors';
import {
  Product,
  ProductCategory,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
} from '../../types';
import { formatPrice } from '../../utils/formatters';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { useCatalogStore } from '../../store/catalogStore';
import { useListsStore } from '../../store/listsStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { productService } from '@shared/services/productService';
import { AddToListModal } from '../../components/ui/AddToListModal';
import { AppFooter } from '../../components/AppFooter';
import { AppTopNavbar } from '../../components/ui/AppTopNavbar';

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 860;

  // Stores
  const { isLoggedIn } = useAuthStore();
  const { addProduct, updateQuantity, getItemQuantity, totalItems } = useCartStore();
  const { isProductInAnyList } = useListsStore();
  const cartBadgeCount = totalItems();

  // Estado del producto
  const [product, setProduct] = useState<Product | null>(() => {
    if (!id) return null;
    const inMem = useCatalogStore.getState().products.find((p) => String(p.id) === String(id));
    return inMem || null;
  });
  const [loading, setLoading] = useState<boolean>(!product);
  const [error, setError] = useState<string | null>(null);

  // Modal de listas
  const [showListModal, setShowListModal] = useState<boolean>(false);

  // Galería / Carrousel
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  // Modal de Zoom / Lightbox
  const [zoomModalVisible, setZoomModalVisible] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panPosition, setPanPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Cantidad para el carrito
  const currentInCart = product ? getItemQuantity(product.id) : 0;
  const [qty, setQty] = useState<number>(1);
  const [qtyText, setQtyText] = useState<string>('1');

  // Carga inicial y actualización de datos frescos del producto
  useEffect(() => {
    let isMounted = true;
    if (!id) {
      setError('Identificador de producto no especificado.');
      setLoading(false);
      return;
    }

    const loadProduct = async () => {
      try {
        setError(null);
        // Si no lo tenemos en memoria, mostramos loader
        if (!product) {
          setLoading(true);
        }

        const freshData = await productService.getById(String(id));
        if (!isMounted) return;

        if (freshData) {
          setProduct(freshData);
        } else if (!product) {
          setError('El producto solicitado no fue encontrado o ya no está disponible.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Error al cargar detalle del producto:', err);
        if (!product) {
          setError('Ocurrió un error al cargar la información del producto.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProduct();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Sincronizar cantidad inicial cuando carga el producto o cambia el carrito
  useEffect(() => {
    if (product) {
      const existing = getItemQuantity(product.id);
      const initial = existing > 0 ? existing : 1;
      setQty(initial);
      setQtyText(String(initial));
    }
  }, [product?.id, currentInCart]);

  // Lista consolidada de imágenes (sin duplicados, ni vacíos)
  const images: string[] = useMemo(() => {
    if (!product) return [];
    const pool: (string | undefined | null)[] = [
      product.imagen,
      product.imagenSecundaria,
      ...(Array.isArray(product.imagenes) ? product.imagenes : []),
    ];
    const valid = pool.filter(
      (img): img is string => typeof img === 'string' && img.trim().length > 0
    );
    return Array.from(new Set(valid));
  }, [product]);

  const currentImageUri = images[activeImageIndex] || images[0] || null;

  // Navegación de carrousel
  const handlePrevImage = useCallback(() => {
    if (images.length <= 1) return;
    setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    setPanPosition({ x: 0, y: 0 });
    setZoomLevel(1);
  }, [images.length]);

  const handleNextImage = useCallback(() => {
    if (images.length <= 1) return;
    setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    setPanPosition({ x: 0, y: 0 });
    setZoomLevel(1);
  }, [images.length]);

  // Apertura de modal de Zoom
  const handleOpenZoom = useCallback((index?: number) => {
    if (typeof index === 'number') {
      setActiveImageIndex(index);
    }
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
    setZoomModalVisible(true);
  }, []);

  const handleCloseZoom = useCallback(() => {
    setZoomModalVisible(false);
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  }, []);

  // Zoom In / Out
  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(3, Math.round((prev + 0.5) * 10) / 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => {
      const next = Math.max(1, Math.round((prev - 0.5) * 10) / 10);
      if (next === 1) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleToggleZoom = useCallback(() => {
    setZoomLevel((prev) => {
      const next = prev > 1 ? 1 : 2;
      if (next === 1) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Atajos de teclado en Web para el modal de zoom
  useEffect(() => {
    if (Platform.OS !== 'web' || !zoomModalVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseZoom();
      } else if (e.key === 'ArrowLeft') {
        handlePrevImage();
      } else if (e.key === 'ArrowRight') {
        handleNextImage();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [zoomModalVisible, handleCloseZoom, handlePrevImage, handleNextImage, handleZoomIn, handleZoomOut]);

  // Copiar código del producto
  const handleCopyCode = useCallback(() => {
    if (!product?.codigo) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(product.codigo);
    }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }, [product?.codigo]);

  // Manejo de cantidad
  const handleDecreaseQty = () => {
    const next = Math.max(1, qty - 1);
    setQty(next);
    setQtyText(String(next));
  };

  const handleIncreaseQty = () => {
    const next = qty + 1;
    setQty(next);
    setQtyText(String(next));
  };

  const handleQtyTextChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setQtyText(cleaned);
    const parsed = parseInt(cleaned, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setQty(parsed);
    }
  };

  const handleQtyBlur = () => {
    const parsed = parseInt(qtyText, 10);
    if (isNaN(parsed) || parsed <= 0) {
      const fallback = currentInCart > 0 ? currentInCart : 1;
      setQty(fallback);
      setQtyText(String(fallback));
    } else {
      setQty(parsed);
      setQtyText(String(parsed));
    }
  };

  // Agregar o Actualizar en Carrito
  const handleConfirmCart = () => {
    if (!product) return;
    const parsed = parseInt(qtyText, 10);
    const finalQty = (!isNaN(parsed) && parsed > 0) ? parsed : qty;

    if (currentInCart > 0) {
      updateQuantity(product.id, finalQty);
      useNotificationStore.getState().showToast({
        message: `Pedido actualizado a ${finalQty} ${finalQty === 1 ? 'unidad' : 'unidades'}.`,
        type: 'success',
        actionLabel: 'Ver carrito',
        onAction: () => router.push('/(tabs)/carrito' as any),
      });
    } else {
      addProduct(product, finalQty);
      useNotificationStore.getState().showToast({
        message: `Agregado ${finalQty} ${finalQty === 1 ? 'unidad' : 'unidades'} al pedido.`,
        type: 'success',
        actionLabel: 'Ver carrito',
        onAction: () => router.push('/(tabs)/carrito' as any),
      });
    }
  };

  // Estados de carga o error
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppTopNavbar activeRoute="/catalogo" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando información del producto...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppTopNavbar activeRoute="/catalogo" />
        <View style={styles.topNav}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.textPrimary} />
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color={Colors.danger} />
          <Text style={styles.errorTitle}>Producto no encontrado</Text>
          <Text style={styles.errorSub}>{error || 'El producto solicitado no está disponible.'}</Text>
          <TouchableOpacity
            style={styles.errorActionBtn}
            onPress={() => router.push('/(tabs)/catalogo' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.errorActionBtnText}>Explorar Catálogo</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const categoryLabel = CATEGORY_LABELS[product.categoria] || product.categoria;
  const categoryIcon = CATEGORY_ICONS[product.categoria] || 'package-variant';
  const inAnyList = isProductInAnyList(product.id);
  const subtotalPrice = (product.precio || 0) * qty;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── MENÚ PRINCIPAL SUPERIOR (Catálogo, Mis Pedidos, Mis Listas, etc.) ── */}
      <AppTopNavbar activeRoute="/catalogo" />

      {/* ── BARRA SECUNDARIA DE NAVEGACIÓN Y BREADCRUMBS ── */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/(tabs)/catalogo' as any);
            }
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={Colors.textPrimary} />
          <Text style={styles.backButtonText}>Volver al catálogo</Text>
        </TouchableOpacity>

        {/* Breadcrumb en Desktop */}
        {isDesktop && (
          <View style={styles.breadcrumbContainer}>
            <TouchableOpacity onPress={() => router.push('/(tabs)' as any)} activeOpacity={0.7}>
              <Text style={styles.breadcrumbLink}>Inicio</Text>
            </TouchableOpacity>
            <Text style={styles.breadcrumbSeparator}>/</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/catalogo' as any)} activeOpacity={0.7}>
              <Text style={styles.breadcrumbLink}>Catálogo</Text>
            </TouchableOpacity>
            <Text style={styles.breadcrumbSeparator}>/</Text>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(tabs)/catalogo' as any, params: { categoria: product.categoria } })}
              activeOpacity={0.7}
            >
              <Text style={styles.breadcrumbLink}>{categoryLabel}</Text>
            </TouchableOpacity>
            <Text style={styles.breadcrumbSeparator}>/</Text>
            <Text style={styles.breadcrumbCurrent} numberOfLines={1}>
              {product.nombre}
            </Text>
          </View>
        )}

        {/* Acceso rápido a carrito */}
        <TouchableOpacity
          style={styles.cartShortcutBtn}
          onPress={() => router.push('/(tabs)/carrito' as any)}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons name="cart-outline" size={22} color={Colors.primary} />
          {cartBadgeCount > 0 && (
            <View style={styles.cartShortcutBadge}>
              <Text style={styles.cartShortcutBadgeText}>{cartBadgeCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.scrollContentDesktop]}
      >
        <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
          {/* ========================================================= */}
          {/* COLUMNA IZQUIERDA: GALERÍA DE FOTOS + CARROUSEL + ZOOM   */}
          {/* ========================================================= */}
          <View style={[styles.leftColumn, isDesktop && styles.leftColumnDesktop]}>
            {/* Contenedor de la Imagen Principal */}
            <View style={styles.mainImageCard}>
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() => handleOpenZoom()}
                style={styles.mainImageTouchable}
                accessibilityLabel="Ampliar foto del producto"
              >
                {currentImageUri ? (
                  <Image
                    source={{ uri: currentImageUri }}
                    style={styles.mainImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.placeholderBox}>
                    <MaterialCommunityIcons name={categoryIcon as any} size={110} color={Colors.primary} />
                    <Text style={styles.placeholderText}>{categoryLabel}</Text>
                  </View>
                )}

                {/* Badge de amplificación y zoom flotante */}
                {currentImageUri && (
                  <View style={styles.zoomHintBadge}>
                    <MaterialCommunityIcons name="magnify-plus-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.zoomHintText}>Click para ampliar y zoom</Text>
                  </View>
                )}

                {/* Contador de fotos en esquina superior */}
                {images.length > 1 && (
                  <View style={styles.imageCounterBadge}>
                    <MaterialCommunityIcons name="image-multiple-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.imageCounterText}>
                      {activeImageIndex + 1} / {images.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Flechas de navegación en la imagen principal si hay varias fotos */}
              {images.length > 1 && (
                <>
                  <TouchableOpacity
                    style={[styles.carouselNavBtn, styles.carouselNavBtnLeft]}
                    onPress={handlePrevImage}
                    activeOpacity={0.8}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <MaterialCommunityIcons name="chevron-left" size={26} color={Colors.textPrimary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.carouselNavBtn, styles.carouselNavBtnRight]}
                    onPress={handleNextImage}
                    activeOpacity={0.8}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <MaterialCommunityIcons name="chevron-right" size={26} color={Colors.textPrimary} />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Carrusel de Miniaturas (Thumbnails) */}
            {images.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailStrip}
              >
                {images.map((imgUri, idx) => {
                  const isActive = activeImageIndex === idx;
                  return (
                    <TouchableOpacity
                      key={`${imgUri}-${idx}`}
                      onPress={() => {
                        setActiveImageIndex(idx);
                        setZoomLevel(1);
                        setPanPosition({ x: 0, y: 0 });
                      }}
                      activeOpacity={0.8}
                      style={[styles.thumbnailCard, isActive && styles.thumbnailCardActive]}
                    >
                      <Image source={{ uri: imgUri }} style={styles.thumbnailImage} resizeMode="contain" />
                      {isActive && <View style={styles.thumbnailIndicatorDot} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Banners informativos debajo de la foto */}
            <View style={styles.trustBannerBox}>
              <View style={styles.trustItem}>
                <MaterialCommunityIcons name="truck-fast-outline" size={22} color={Colors.primary} />
                <View style={styles.trustItemTextCol}>
                  <Text style={styles.trustItemTitle}>Reparto a domicilio</Text>
                  <Text style={styles.trustItemSub}>Entregas programadas en tu zona</Text>
                </View>
              </View>
              <View style={styles.trustDivider} />
              <View style={styles.trustItem}>
                <MaterialCommunityIcons name="shield-check-outline" size={22} color={Colors.success} />
                <View style={styles.trustItemTextCol}>
                  <Text style={styles.trustItemTitle}>Garantía de calidad</Text>
                  <Text style={styles.trustItemSub}>Química General Deheza</Text>
                </View>
              </View>
            </View>
          </View>

          {/* ========================================================= */}
          {/* COLUMNA DERECHA: INFO, PRECIO, CARRITO Y DESCRIPCIÓN     */}
          {/* ========================================================= */}
          <View style={[styles.rightColumn, isDesktop && styles.rightColumnDesktop]}>
            {/* Categoría y Botón de Lista */}
            <View style={styles.categoryAndActionsRow}>
              <View style={styles.categoryChip}>
                <MaterialCommunityIcons name={categoryIcon as any} size={15} color={Colors.primary} />
                <Text style={styles.categoryChipText}>{categoryLabel}</Text>
              </View>

              {/* Botón Guardar en Mis Listas */}
              <TouchableOpacity
                style={[styles.bookmarkButton, inAnyList && styles.bookmarkButtonActive]}
                onPress={() => {
                  if (!isLoggedIn) {
                    useNotificationStore.getState().showToast({
                      message: 'Iniciá sesión para guardar productos en tus listas.',
                      type: 'warning',
                    });
                    return;
                  }
                  setShowListModal(true);
                }}
                activeOpacity={0.78}
              >
                <MaterialCommunityIcons
                  name={inAnyList ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={inAnyList ? Colors.primary : '#64748B'}
                />
                <Text style={[styles.bookmarkButtonText, inAnyList && styles.bookmarkButtonTextActive]}>
                  {inAnyList ? 'En mis listas' : 'Guardar en lista'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Código de producto SKU */}
            <View style={styles.skuRow}>
              <Text style={styles.skuLabel}>CÓDIGO:</Text>
              <Text style={styles.skuValue}>{product.codigo}</Text>
              <TouchableOpacity
                style={styles.copySkuBtn}
                onPress={handleCopyCode}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MaterialCommunityIcons
                  name={copiedCode ? 'check' : 'content-copy'}
                  size={15}
                  color={copiedCode ? Colors.success : '#64748B'}
                />
                <Text style={[styles.copySkuText, copiedCode && { color: Colors.success }]}>
                  {copiedCode ? 'Copiado' : 'Copiar'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Título Principal */}
            <Text style={styles.productTitle}>{product.nombre}</Text>

            {/* Presentación y Unidad */}
            <View style={styles.presentationRow}>
              {product.presentacion && (
                <View style={styles.presentationBadge}>
                  <Text style={styles.presentationBadgeText}>{product.presentacion}</Text>
                </View>
              )}
              <Text style={styles.unitText}>Venta por {product.unidad || 'unidad'}</Text>
            </View>

            {/* Sección de Precio */}
            <View style={styles.priceSectionCard}>
              {isLoggedIn ? (
                <>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceAmount}>
                      {product.precio && product.precio > 0 ? formatPrice(product.precio) : 'Sin precio'}
                    </Text>
                    <Text style={styles.priceSubunit}>/ {product.unidad || 'unidad'}</Text>
                  </View>
                  <Text style={styles.priceClarification}>Precios finales vigentes con IVA incluido.</Text>
                </>
              ) : (
                <View style={styles.publicPriceNotice}>
                  <View style={styles.publicPriceHeader}>
                    <MaterialCommunityIcons name="lock-outline" size={24} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.publicPriceTitle}>Precios exclusivos para clientes</Text>
                      <Text style={styles.publicPriceSub}>
                        Iniciá sesión o registrate para consultar precios y realizar pedidos directos.
                      </Text>
                    </View>
                  </View>
                  <View style={styles.publicPriceBtnGroup}>
                    <TouchableOpacity
                      style={styles.publicLoginBtn}
                      onPress={() => router.push({ pathname: '/(tabs)' as any, params: { tab: 'login' } })}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.publicLoginBtnText}>Iniciar sesión</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.publicRegisterBtn}
                      onPress={() => router.push({ pathname: '/(tabs)' as any, params: { tab: 'register' } })}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.publicRegisterBtnText}>Crear cuenta</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Sección de Compra y Carrito (Solo si está logueado) */}
            {isLoggedIn && (
              <View style={styles.cartActionBox}>
                {/* Banner de cantidad ya existente en el carrito */}
                {currentInCart > 0 && (
                  <View style={styles.alreadyInCartBanner}>
                    <MaterialCommunityIcons name="cart-check" size={20} color={Colors.primary} />
                    <Text style={styles.alreadyInCartText}>
                      Ya tenés <Text style={{ fontWeight: '700' }}>{currentInCart} {currentInCart === 1 ? 'unidad' : 'unidades'}</Text> en tu pedido actual.
                    </Text>
                  </View>
                )}

                {/* Selector de cantidad y subtotal */}
                <View style={styles.qtyControlSection}>
                  <View>
                    <Text style={styles.qtyFieldLabel}>
                      {currentInCart > 0 ? 'Cantidad a definir:' : 'Cantidad a pedir:'}
                    </Text>
                    <Text style={styles.subtotalHint}>
                      Subtotal: <Text style={styles.subtotalValue}>{formatPrice(subtotalPrice)}</Text>
                    </Text>
                  </View>

                  <View style={styles.qtyStepperRow}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={handleDecreaseQty}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Disminuir una unidad"
                    >
                      <Text style={styles.stepperBtnText}>−</Text>
                    </TouchableOpacity>

                    <TextInput
                      style={styles.stepperInput}
                      value={qtyText}
                      onChangeText={handleQtyTextChange}
                      onBlur={handleQtyBlur}
                      keyboardType="numeric"
                      selectTextOnFocus
                      returnKeyType="done"
                      maxLength={5}
                      accessibilityLabel="Ingresar cantidad numérica"
                    />

                    <TouchableOpacity
                      style={[styles.stepperBtn, styles.stepperBtnAdd]}
                      onPress={handleIncreaseQty}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Aumentar una unidad"
                    >
                      <Text style={[styles.stepperBtnText, styles.stepperBtnAddText]}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Botón Principal de Acción */}
                <TouchableOpacity
                  style={[styles.mainBuyBtn, currentInCart > 0 && styles.mainBuyBtnUpdate]}
                  onPress={handleConfirmCart}
                  activeOpacity={0.88}
                >
                  <MaterialCommunityIcons
                    name={currentInCart > 0 ? 'cart-check' : 'cart-plus'}
                    size={22}
                    color="#FFFFFF"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.mainBuyBtnText}>
                    {currentInCart > 0
                      ? (qty === currentInCart
                          ? `Mantener ${qty} en el Pedido`
                          : `Actualizar a ${qty} en el Pedido`)
                      : `Agregar ${qty > 1 ? `${qty} al Pedido` : 'al Pedido'}`}
                  </Text>
                  <Text style={styles.mainBuyBtnSubtotal}>· {formatPrice(subtotalPrice)}</Text>
                </TouchableOpacity>

                {currentInCart > 0 && (
                  <TouchableOpacity
                    style={styles.goToCartBtn}
                    onPress={() => router.push('/(tabs)/carrito' as any)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.goToCartBtnText}>Ir al Carrito de Compras →</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Tarjeta de Descripción del Producto */}
            <View style={styles.descriptionCard}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="text-box-outline" size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Descripción del Producto</Text>
              </View>
              <Text style={styles.descriptionText}>
                {product.descripcion && product.descripcion.trim().length > 0
                  ? product.descripcion
                  : 'Este producto no posee descripción técnica adicional proporcionada por el fabricante.'}
              </Text>
            </View>

            {/* Ficha de Especificaciones Técnicas */}
            <View style={styles.specsCard}>
              <View style={styles.sectionTitleRow}>
                <MaterialCommunityIcons name="clipboard-list-outline" size={20} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Ficha y Especificaciones</Text>
              </View>
              <View style={styles.specsGrid}>
                <View style={styles.specRow}>
                  <Text style={styles.specKey}>Código / SKU</Text>
                  <Text style={styles.specVal}>{product.codigo}</Text>
                </View>
                <View style={styles.specRow}>
                  <Text style={styles.specKey}>Categoría</Text>
                  <Text style={styles.specVal}>{categoryLabel}</Text>
                </View>
                {product.subcategoria && (
                  <View style={styles.specRow}>
                    <Text style={styles.specKey}>Subcategoría</Text>
                    <Text style={styles.specVal}>{product.subcategoria}</Text>
                  </View>
                )}
                {product.presentacion && (
                  <View style={styles.specRow}>
                    <Text style={styles.specKey}>Presentación</Text>
                    <Text style={styles.specVal}>{product.presentacion}</Text>
                  </View>
                )}
                <View style={styles.specRow}>
                  <Text style={styles.specKey}>Unidad de medida</Text>
                  <Text style={styles.specVal}>{product.unidad || 'Unidad'}</Text>
                </View>
                {product.marca && (
                  <View style={styles.specRow}>
                    <Text style={styles.specKey}>Marca</Text>
                    <Text style={styles.specVal}>{product.marca}</Text>
                  </View>
                )}
                <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.specKey}>Estado</Text>
                  <Text style={[styles.specVal, { color: Colors.success, fontWeight: '700' }]}>Disponible</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <AppFooter />
      </ScrollView>

      {/* ========================================================= */}
      {/* MODAL DE ZOOM / LIGHTBOX AMPLIFICADO                      */}
      {/* ========================================================= */}
      <Modal
        visible={zoomModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseZoom}
      >
        <View style={styles.lightboxOverlay}>
          {/* Backdrop absoluto global que cierra al clickear fuera */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleCloseZoom}
            accessibilityLabel="Cerrar visor"
          />

          {/* Barra superior de controles del Lightbox */}
          <View style={styles.lightboxTopBar} onStartShouldSetResponder={() => true}>
            <View style={styles.lightboxInfoCol}>
              <Text style={styles.lightboxTitle} numberOfLines={1}>
                {product.nombre}
              </Text>
              <Text style={styles.lightboxSubtitle}>
                {images.length > 1
                  ? `Foto ${activeImageIndex + 1} de ${images.length}`
                  : 'Vista ampliada en alta resolución'}
              </Text>
            </View>

            {/* Controles de Zoom */}
            <View style={styles.lightboxControls}>
              <TouchableOpacity
                style={styles.lightboxBtn}
                onPress={handleZoomOut}
                disabled={zoomLevel <= 1}
                accessibilityLabel="Alejar foto"
              >
                <MaterialCommunityIcons
                  name="magnify-minus-outline"
                  size={20}
                  color={zoomLevel <= 1 ? '#64748B' : '#FFFFFF'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.lightboxBtnZoomBadge}
                onPress={handleToggleZoom}
                accessibilityLabel="Alternar nivel de zoom"
              >
                <Text style={styles.lightboxZoomLevelText}>{Math.round(zoomLevel * 100)}%</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.lightboxBtn}
                onPress={handleZoomIn}
                disabled={zoomLevel >= 3}
                accessibilityLabel="Acercar foto"
              >
                <MaterialCommunityIcons
                  name="magnify-plus-outline"
                  size={20}
                  color={zoomLevel >= 3 ? '#64748B' : '#FFFFFF'}
                />
              </TouchableOpacity>

              <View style={styles.lightboxDivider} />

              <TouchableOpacity
                style={styles.lightboxCloseBtn}
                onPress={handleCloseZoom}
                accessibilityLabel="Cerrar visor de imagen"
              >
                <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Área central con imagen ampliada y soporte de zoom */}
          <View style={styles.lightboxStage}>
            {/* Backdrop clickeable dentro del stage para cerrar al hacer clic en zonas oscuras */}
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={handleCloseZoom}
            />

            {images.length > 1 && (
              <TouchableOpacity
                style={[styles.lightboxNavBtn, styles.lightboxNavBtnLeft]}
                onPress={(e) => {
                  e.stopPropagation?.();
                  handlePrevImage();
                }}
                activeOpacity={0.8}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <MaterialCommunityIcons name="chevron-left" size={36} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            <ScrollView
              contentContainerStyle={styles.lightboxScrollContainer}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              centerContent
            >
              {/* Clic en el área de padding o fondo del ScrollView cierra el visor */}
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={handleCloseZoom}
              />

              {currentImageUri ? (
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleToggleZoom();
                  }}
                  style={styles.lightboxImageTouchable}
                >
                  <Image
                    source={{ uri: currentImageUri }}
                    style={[
                      styles.lightboxImage,
                      {
                        transform: [{ scale: zoomLevel }],
                      },
                    ]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.placeholderBox}>
                  <MaterialCommunityIcons name={categoryIcon as any} size={130} color={Colors.primary} />
                </View>
              )}
            </ScrollView>

            {images.length > 1 && (
              <TouchableOpacity
                style={[styles.lightboxNavBtn, styles.lightboxNavBtnRight]}
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleNextImage();
                }}
                activeOpacity={0.8}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <MaterialCommunityIcons name="chevron-right" size={36} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Barra inferior con miniaturas en el Lightbox si hay más de 1 imagen */}
          {images.length > 1 && (
            <View style={styles.lightboxBottomBar} onStartShouldSetResponder={() => true}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.lightboxThumbsRow}
              >
                {images.map((imgUri, idx) => {
                  const isActive = activeImageIndex === idx;
                  return (
                    <TouchableOpacity
                      key={`lightbox-${imgUri}-${idx}`}
                      onPress={() => {
                        setActiveImageIndex(idx);
                        setZoomLevel(1);
                        setPanPosition({ x: 0, y: 0 });
                      }}
                      style={[styles.lightboxThumb, isActive && styles.lightboxThumbActive]}
                      activeOpacity={0.8}
                    >
                      <Image source={{ uri: imgUri }} style={styles.lightboxThumbImg} resizeMode="contain" />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      {/* Modal para guardar en Mis Listas */}
      <AddToListModal
        visible={showListModal}
        product={product}
        onClose={() => setShowListModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 14,
  },
  errorSub: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 420,
  },
  errorActionBtn: {
    marginTop: 22,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  errorActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },

  // ── Top Navigation Bar ──
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginLeft: 20,
    marginRight: 20,
  },
  breadcrumbLink: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  breadcrumbSeparator: {
    fontSize: 13,
    color: '#94A3B8',
  },
  breadcrumbCurrent: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
    flexShrink: 1,
  },
  cartShortcutBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#EBF0FF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartShortcutBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartShortcutBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Contenido Principal ──
  scrollContent: {
    paddingBottom: 40,
  },
  scrollContentDesktop: {
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  mainLayout: {
    flexDirection: 'column',
    maxWidth: 1240,
    width: '100%',
    alignSelf: 'center',
  },
  mainLayoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 36,
  },

  // ── Columna Izquierda (Galería & Carrousel) ──
  leftColumn: {
    width: '100%',
    padding: 16,
  },
  leftColumnDesktop: {
    width: '48%',
    padding: 0,
    position: 'sticky' as any,
    top: 24,
  },
  mainImageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    aspectRatio: 1,
    width: '100%',
    maxHeight: 520,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  mainImageTouchable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainImage: {
    width: '88%',
    height: '88%',
  },
  placeholderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderText: {
    marginTop: 10,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  zoomHintBadge: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  zoomHintText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  imageCounterBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  carouselNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  carouselNavBtnLeft: {
    left: 12,
  },
  carouselNavBtnRight: {
    right: 12,
  },

  // Strip de miniaturas
  thumbnailStrip: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
  },
  thumbnailCard: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
  },
  thumbnailCardActive: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailIndicatorDot: {
    position: 'absolute',
    bottom: -6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },

  // Confianza y garantías
  trustBannerBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginTop: 14,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trustItemTextCol: {
    flex: 1,
  },
  trustItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  trustItemSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  trustDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },

  // ── Columna Derecha (Detalles, Compra y Descripción) ──
  rightColumn: {
    width: '100%',
    padding: 16,
  },
  rightColumnDesktop: {
    width: '52%',
    padding: 0,
  },
  categoryAndActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EBF0FF',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  bookmarkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bookmarkButtonActive: {
    backgroundColor: '#EBF0FF',
    borderColor: '#BFDBFE',
  },
  bookmarkButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  bookmarkButtonTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },

  skuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  skuLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  skuValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  copySkuBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  copySkuText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  productTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 34,
    marginBottom: 8,
  },
  presentationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  presentationBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  presentationBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  unitText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },

  // Tarjeta de Precios
  priceSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  priceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.primary,
  },
  priceSubunit: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },
  priceClarification: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
  },
  publicPriceNotice: {
    gap: 12,
  },
  publicPriceHeader: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  publicPriceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  publicPriceSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 18,
  },
  publicPriceBtnGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  publicLoginBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  publicLoginBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  publicRegisterBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  publicRegisterBtnText: {
    color: '#334155',
    fontWeight: '600',
    fontSize: 14,
  },

  // Sección de Compra y Carrito
  cartActionBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  alreadyInCartBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EBF0FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  alreadyInCartText: {
    fontSize: 13,
    color: Colors.primary,
  },
  qtyControlSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  qtyFieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtotalHint: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  subtotalValue: {
    fontWeight: '700',
    color: Colors.primary,
  },
  qtyStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  stepperBtnText: {
    fontSize: 20,
    color: '#0F172A',
    fontWeight: '600',
  },
  stepperInput: {
    width: 60,
    height: 42,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  stepperBtnAdd: {
    backgroundColor: Colors.primary,
  },
  stepperBtnAddText: {
    color: '#FFFFFF',
  },
  mainBuyBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  mainBuyBtnUpdate: {
    backgroundColor: '#0F766E', // Tono esmeralda elegante para indicar actualización
    shadowColor: '#0F766E',
  },
  mainBuyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  mainBuyBtnSubtotal: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  goToCartBtn: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  goToCartBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },

  // Tarjeta de Descripción
  descriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  descriptionText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },

  // Ficha Técnica
  specsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 20,
  },
  specsGrid: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  specKey: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  specVal: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },

  // ── MODAL DE ZOOM / LIGHTBOX ──
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 29, 0.96)',
    justifyContent: 'space-between',
  },
  lightboxTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  lightboxInfoCol: {
    flex: 1,
    marginRight: 16,
  },
  lightboxTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lightboxSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  lightboxControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lightboxBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxBtnZoomBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  lightboxZoomLevelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  lightboxDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 4,
  },
  lightboxCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Área central del visor
  lightboxStage: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxImageTouchable: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  lightboxImage: {
    width: Platform.OS === 'web' ? '80vw' as any : 360,
    height: Platform.OS === 'web' ? '70vh' as any : 400,
    maxWidth: 900,
    maxHeight: 700,
  },
  lightboxNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  lightboxNavBtnLeft: {
    left: 20,
  },
  lightboxNavBtnRight: {
    right: 20,
  },

  // Miniaturas del visor
  lightboxBottomBar: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  lightboxThumbsRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  lightboxThumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  lightboxThumbActive: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
  },
  lightboxThumbImg: {
    width: '100%',
    height: '100%',
  },
});
