import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  ListRenderItemInfo,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { ProductCard } from '../../components/ProductCard';
import { SearchBar } from '../../components/ui/SearchBar';
import { useCatalogStore } from '../../store/catalogStore';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { formatPrice } from '../../utils/formatters';

import {
  ProductCategory,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  ALL_PRODUCT_CATEGORIES,
  Product,
} from '../../types';
import MaterialCommunityIcons from '../../components/icons/MaterialCommunityIcons';
// ──────────────────────────────────────────────────────────────
// Constantes de layout para getItemLayout (scroll ultra-fluido)
// ──────────────────────────────────────────────────────────────
const CARD_HEIGHT = 240;   // Altura estimada de cada ProductCard
const CARD_GAP = 12;       // Gap entre filas (columnWrapperStyle + marginBottom)
const ROW_HEIGHT = CARD_HEIGHT + CARD_GAP;
const LIST_PADDING = 16;   // padding del contentContainerStyle

// ──────────────────────────────────────────────────────────────
// Hook: debounce para la búsqueda (no filtra en cada keystroke)
// ──────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}



// ──────────────────────────────────────────────────────────────
// Pantalla Catálogo
// ──────────────────────────────────────────────────────────────
export default function CatalogoScreen() {
  const router = useRouter();
  const { isLoggedIn } = useAuthStore();
  const { addProduct } = useCartStore();
  const totalItems = useCartStore((state) => state.totalItems());
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const numGridColumns = isDesktop ? (width >= 1200 ? 4 : 3) : (width < 360 ? 1 : 2);

  const {
    products,
    totalProductsCount,
    totalPagesCount,
    fetchPaginatedProducts,
    isLoading,
    source,
    importedFileName,
    superOffers,
    categoryBanners,
    fetchCategoryBanners,
    fetchSuperOffers,
    categoryNames,
    fetchCategoryNames,
    activeCategories,
  } = useCatalogStore();
  const { categoria } = useLocalSearchParams<{ categoria?: string }>();

  const [rawQuery, setRawQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'todos'>('todos');
  const [sortBy, setSortBy] = useState<'relevante' | 'precio-bajo' | 'precio-alto' | 'mas-vendido'>('relevante');
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const PAGE_SIZE = 24;
  const [currentPage, setCurrentPage] = useState(1);
  const flatListRef = useRef<FlatList>(null);

  // Debounce para búsqueda
  const query = useDebounce(rawQuery, 200);

  // Cargar ofertas y banners accesorios
  useEffect(() => {
    fetchSuperOffers();
    fetchCategoryBanners();
    fetchCategoryNames();
  }, [isLoggedIn]);

  // Si viene una categoría por parámetro, la aplicamos
  useEffect(() => {
    if (categoria) {
      setSelectedCategory(categoria as ProductCategory);
    }
  }, [categoria]);

  // Resetear a página 1 cuando cambia el filtro, término de búsqueda u orden
  useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedCategory, sortBy]);

  // ⚡ CONSULTA PAGINADA SERVIDOR (Supabase range/limit + exact count)
  useEffect(() => {
    fetchPaginatedProducts({
      page: currentPage,
      pageSize: PAGE_SIZE,
      search: query,
      categoria: selectedCategory === 'todos' ? undefined : selectedCategory,
      sortBy: sortBy,
    });
  }, [currentPage, query, selectedCategory, sortBy, isLoggedIn]);

  const filterOptions = useMemo(() => {
    const catsToShow = activeCategories.length > 0 ? activeCategories : ALL_PRODUCT_CATEGORIES;
    return [
      { key: 'todos' as const, label: 'Todos', icon: 'magnify' },
      ...catsToShow.map((cat) => ({
        key: cat,
        label: categoryNames[cat] || CATEGORY_LABELS[cat],
        icon: CATEGORY_ICONS[cat],
      })),
    ];
  }, [categoryNames, activeCategories]);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPagesCount) {
      setCurrentPage(page);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [totalPagesCount]);

  const renderPaginationFooter = useCallback(() => {
    if (totalProductsCount === 0) return null;

    const startItem = (currentPage - 1) * PAGE_SIZE + 1;
    const endItem = Math.min(currentPage * PAGE_SIZE, totalProductsCount);

    const pageNumbers: number[] = [];
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPagesCount, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <View style={styles.paginationWrapper}>
        <Text style={styles.paginationInfoText}>
          Mostrando <Text style={styles.paginationHighlight}>{startItem}-{endItem}</Text> de <Text style={styles.paginationTotalText}>{totalProductsCount.toLocaleString('es-AR')}</Text> productos
        </Text>

        {totalPagesCount > 1 && (
          <View style={styles.paginationControlsRow}>
            {/* Primera página */}
            <TouchableOpacity
              style={[styles.paginationBtn, currentPage === 1 && styles.paginationBtnDisabled]}
              onPress={() => handlePageChange(1)}
              disabled={currentPage === 1}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-double-left" size={18} color={currentPage === 1 ? '#94A3B8' : Colors.primary} />
            </TouchableOpacity>

            {/* Anterior */}
            <TouchableOpacity
              style={[styles.paginationBtn, currentPage === 1 && styles.paginationBtnDisabled]}
              onPress={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-left" size={18} color={currentPage === 1 ? '#94A3B8' : Colors.primary} />
              <Text style={[styles.paginationBtnText, currentPage === 1 && styles.paginationBtnTextDisabled]}>Ant</Text>
            </TouchableOpacity>

            {/* Números de página */}
            {startPage > 1 && <Text style={styles.paginationEllipsis}>...</Text>}

            {pageNumbers.map((p) => {
              const isActive = p === currentPage;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.paginationNumberBtn, isActive && styles.paginationNumberBtnActive]}
                  onPress={() => handlePageChange(p)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.paginationNumberText, isActive && styles.paginationNumberTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {endPage < totalPagesCount && <Text style={styles.paginationEllipsis}>...</Text>}

            {/* Siguiente */}
            <TouchableOpacity
              style={[styles.paginationBtn, currentPage === totalPagesCount && styles.paginationBtnDisabled]}
              onPress={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPagesCount}
              activeOpacity={0.7}
            >
              <Text style={[styles.paginationBtnText, currentPage === totalPagesCount && styles.paginationBtnTextDisabled]}>Sig</Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={currentPage === totalPagesCount ? '#94A3B8' : Colors.primary} />
            </TouchableOpacity>

            {/* Última página */}
            <TouchableOpacity
              style={[styles.paginationBtn, currentPage === totalPagesCount && styles.paginationBtnDisabled]}
              onPress={() => handlePageChange(totalPagesCount)}
              disabled={currentPage === totalPagesCount}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="chevron-double-right" size={18} color={currentPage === totalPagesCount ? '#94A3B8' : Colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [totalProductsCount, currentPage, totalPagesCount, handlePageChange]);

  // Filtrar ofertas que pertenecen a esta categoría específica
  const categoryOffers = useMemo(() => {
    if (selectedCategory === 'todos') return [];
    return superOffers.filter((offer: any) => {
      const items = offer.super_offer_items || [];
      return items.some((it: any) => {
        const prodCat = it.products?.categoria || '';
        return prodCat === selectedCategory;
      });
    });
  }, [selectedCategory, superOffers]);

  const addOfferToCart = (offer: any) => {
    const items: any[] = offer.super_offer_items || [];
    if (items.length === 0) return;

    const totalOriginalComboPrice = items.reduce((sum: number, it: any) => {
      const p = it.products;
      const unitOrigPrice = p ? (p.precio || 0) : 0;
      const qty = Math.max(1, Math.ceil(it.cantidad || 1));
      return sum + (unitOrigPrice * qty);
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

        addProduct(
          { ...it.products, precio: effectiveUnitPrice },
          qty,
          true
        );
      }
    });

    useNotificationStore.getState().showToast({
      message: 'Combo de oferta agregado al carrito.',
      type: 'success',
      actionLabel: 'Ver carrito',
      onAction: () => {
        router.push('/(tabs)/carrito');
      },
      secondaryActionLabel: 'Seguir comprando',
      onSecondaryAction: () => { },
    });
  };


  // getItemLayout para scroll ultra-fluido en listas grandes
  const getItemLayout = useCallback(
    (_: ArrayLike<Product> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: LIST_PADDING + ROW_HEIGHT * Math.floor(index / 2),
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Product>) => (
      <ProductCard
        product={item}
        style={styles.productCard}
        onPress={(p) => setSelectedProductDetails(p)}
      />
    ),
    []
  );

  const keyExtractor = useCallback((item: Product) => String(item.id), []);

  const total = totalProductsCount;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ── Header del catálogo reorganizado ── */}
      <View style={isDesktop ? styles.desktopHeaderRow : styles.mobileHeaderContainer}>
        {isDesktop ? (
          // DESKTOP LAYOUT
          <View style={styles.desktopHeaderContent}>
            <View style={styles.desktopLeftSection}>
              <Text style={styles.headerTitle}>Catálogo</Text>

              <View style={styles.desktopSearchWrapper}>
                <SearchBar
                  value={rawQuery}
                  onChangeText={setRawQuery}
                  placeholder="Buscar por nombre, código o descripción..."
                  style={StyleSheet.flatten([styles.searchBar, { marginBottom: 0 }])}
                />
              </View>
            </View>

            <View style={styles.desktopRightSection}>
              {!isLoggedIn && (
                <View style={{ flexDirection: 'row', gap: Spacing.sm, marginRight: Spacing.md }}>
                  <TouchableOpacity
                    style={styles.headerLoginBtn}
                    onPress={() => router.push({ pathname: '/(tabs)', params: { tab: 'login' } })}
                  >
                    <Text style={styles.headerLoginBtnText}>Iniciar sesión</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.headerRegisterBtn}
                    onPress={() => router.push({ pathname: '/(tabs)', params: { tab: 'register' } })}
                  >
                    <Text style={styles.headerRegisterBtnText}>Registrarme</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={styles.filterBtnCompact}
                onPress={() => setShowFilterDropdown(!showFilterDropdown)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="filter-variant" size={20} color={Colors.primary} />
                <Text style={styles.filterBtnCompactText}>Filtros</Text>
                <MaterialCommunityIcons name={showFilterDropdown ? 'chevron-up' : 'chevron-down'} size={18} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // MOBILE LAYOUT
          <View style={styles.mobileHeaderContent}>
            <View style={[styles.mobileTitleRow, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={styles.headerTitle}>Catálogo</Text>
                <Text style={styles.headerSubtitle}>
                  {`${total.toLocaleString('es-AR')} art.`}
                </Text>
              </View>
              {Platform.OS === 'web' && (
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/carrito')}
                  style={styles.mobileHeaderCartBtn}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="cart" size={24} color={Colors.primary} />
                  {totalItems > 0 && (
                    <View style={styles.mobileHeaderCartBadge}>
                      <Text style={styles.mobileHeaderCartBadgeText}>{totalItems}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.mobileSearchRow}>
              <View style={{ flex: 1 }}>
                <SearchBar
                  value={rawQuery}
                  onChangeText={setRawQuery}
                  placeholder="Buscar..."
                  style={StyleSheet.flatten([styles.searchBar, { marginBottom: 0 }])}
                />
              </View>
              <TouchableOpacity
                style={styles.filterBtnCompactMobile}
                onPress={() => setShowFilterDropdown(!showFilterDropdown)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="filter-variant" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {!isLoggedIn && (
              <View style={styles.mobileHeaderAuthRow}>
                <TouchableOpacity
                  style={[styles.headerLoginBtn, { flex: 1 }]}
                  onPress={() => router.push({ pathname: '/(tabs)', params: { tab: 'login' } })}
                >
                  <Text style={styles.headerLoginBtnText}>Iniciar sesión</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.headerRegisterBtn, { flex: 1 }]}
                  onPress={() => router.push({ pathname: '/(tabs)', params: { tab: 'register' } })}
                >
                  <Text style={styles.headerRegisterBtnText}>Registrarme</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── Panel flotante de Filtros y Ordenamiento ── */}
        {showFilterDropdown && (
          <View style={[styles.filterDropdownPanel, isDesktop && styles.filterDropdownPanelDesktop]}>
            {/* Sección de Ordenamiento */}
            <Text style={styles.dropdownSectionTitle}>Ordenar por:</Text>
            <View style={styles.dropdownChipsRow}>
              <TouchableOpacity onPress={() => { setSortBy('relevante'); setShowFilterDropdown(false); }} style={[styles.sortChip, sortBy === 'relevante' && styles.sortChipActive]}>
                <Text style={[styles.sortChipText, sortBy === 'relevante' && styles.sortChipTextActive]}>⭐ Destacados</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSortBy('precio-bajo'); setShowFilterDropdown(false); }} style={[styles.sortChip, sortBy === 'precio-bajo' && styles.sortChipActive]}>
                <Text style={[styles.sortChipText, sortBy === 'precio-bajo' && styles.sortChipTextActive]}>📉 Menor Precio</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSortBy('precio-alto'); setShowFilterDropdown(false); }} style={[styles.sortChip, sortBy === 'precio-alto' && styles.sortChipActive]}>
                <Text style={[styles.sortChipText, sortBy === 'precio-alto' && styles.sortChipTextActive]}>📈 Mayor Precio</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setSortBy('mas-vendido'); setShowFilterDropdown(false); }} style={[styles.sortChip, sortBy === 'mas-vendido' && styles.sortChipActive]}>
                <Text style={[styles.sortChipText, sortBy === 'mas-vendido' && styles.sortChipTextActive]}>🔥 Más Vendidos</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dropdownDivider} />

            {/* Sección de Categorías */}
            <Text style={styles.dropdownSectionTitle}>Categorías:</Text>
            <ScrollView
              horizontal={!isDesktop}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={isDesktop ? styles.dropdownCategoriesGrid : styles.dropdownCategoriesScroll}
              keyboardShouldPersistTaps="handled"
            >
              {filterOptions.map((cat) => {
                const isSelected = selectedCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                    onPress={() => {
                      setSelectedCategory(cat.key);
                      setShowFilterDropdown(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons
                      name={cat.key === 'todos' ? 'magnify' : (cat.icon as any)}
                      size={18}
                      color={isSelected ? Colors.primary : Colors.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.categoryChipLabel, isSelected && styles.categoryChipLabelSelected]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* ── Barra fija "Volver a categorías" (visible siempre que haya una categoría seleccionada) ── */}
      {selectedCategory !== 'todos' && (
        <View style={styles.backBarFixed}>
          <TouchableOpacity
            style={styles.backBarBtn}
            onPress={() => setSelectedCategory('todos')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-left" size={16} color={Colors.primary} />
            <Text style={styles.backBarBtnText}>Todas las secciones</Text>
          </TouchableOpacity>
          <Text style={styles.backBarCategory}>
            {categoryNames[selectedCategory] || CATEGORY_LABELS[selectedCategory]}
          </Text>
        </View>
      )}

      {/* ── Lista de productos ── */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ color: Colors.textSecondary, fontSize: 16 }}>Cargando catálogo...</Text>
        </View>
      ) : totalProductsCount === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No encontramos productos</Text>
          <Text style={styles.emptySubtitle}>
            Probá con otro término o cambiá el filtro de categoría
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          key={`grid-cols-${numGridColumns}`}
          data={products}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={numGridColumns}
          contentContainerStyle={[styles.productList, { paddingBottom: 90 }]}
          columnWrapperStyle={numGridColumns > 1 ? styles.productRow : undefined}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"

          ListHeaderComponent={
            selectedCategory !== 'todos' ? (
              <View style={styles.listHeaderContainer}>
                {/* Banner de Portada de Categoría */}
                <View style={styles.coverBannerCard}>
                  {categoryBanners[selectedCategory] ? (
                    <Image
                      source={{ uri: categoryBanners[selectedCategory] }}
                      style={styles.coverBannerImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.coverBannerImage, { backgroundColor: '#F1F5F9' }]} />
                  )}
                  <View style={styles.coverBannerOverlay} />
                  <View style={styles.coverBannerContent}>
                    <Text style={styles.coverBannerTitle}>{categoryNames[selectedCategory] || CATEGORY_LABELS[selectedCategory]}</Text>
                    <Text style={styles.coverBannerSub}>Explorá nuestro catálogo especializado</Text>
                  </View>
                </View>

                {/* Ofertas de la Categoría */}
                {categoryOffers.length > 0 && (
                  <View style={styles.categoryOffersSection}>
                    <Text style={styles.categoryOffersTitle}>🔥 OFERTAS EN ESTA SECCIÓN</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.categoryOffersScroll}
                    >
                      {categoryOffers.map((offer: any) => {
                        const discount = offer.precio_original > 0
                          ? Math.round(((offer.precio_original - offer.precio_oferta) / offer.precio_original) * 100)
                          : 0;
                        const items = offer.super_offer_items || [];
                        return (
                          <View key={offer.id} style={styles.categoryOfferCard}>
                            {discount > 0 && (
                              <View style={styles.offerBadge}>
                                <Text style={styles.offerBadgeText}>-{discount}%</Text>
                              </View>
                            )}
                            <Text style={styles.offerName} numberOfLines={1}>{offer.nombre}</Text>
                            <View style={styles.offerItems}>
                              {items.slice(0, 2).map((it: any) => (
                                <Text key={it.id} style={styles.offerItemText} numberOfLines={1}>
                                  • {it.cantidad} {it.unidad} · {it.products?.nombre}
                                </Text>
                              ))}
                            </View>
                            {isLoggedIn ? (
                              <>
                                <View style={styles.offerPrices}>
                                  <Text style={styles.offerOriginal}>{formatPrice(offer.precio_original)}</Text>
                                  <Text style={styles.offerPromo}>{formatPrice(offer.precio_oferta)}</Text>
                                </View>
                                <TouchableOpacity style={styles.offerBuyBtn} onPress={() => addOfferToCart(offer)}>
                                  <Text style={styles.offerBuyBtnText}>Lo quiero</Text>
                                </TouchableOpacity>
                              </>
                            ) : (
                              <>
                                <View style={styles.offerPrices}>
                                  <Text style={styles.publicOfferPriceText}>Registrate para ver precios</Text>
                                </View>
                                <View style={styles.publicOfferCardButtons}>
                                  <TouchableOpacity
                                    style={styles.publicOfferLoginBtn}
                                    onPress={() => router.push({ pathname: '/(tabs)', params: { tab: 'login' } })}
                                  >
                                    <Text style={styles.publicOfferLoginBtnText}>Ingresar</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.publicOfferRegisterBtn}
                                    onPress={() => router.push({ pathname: '/(tabs)', params: { tab: 'register' } })}
                                  >
                                    <Text style={styles.publicOfferRegisterBtnText}>Registrarme</Text>
                                  </TouchableOpacity>
                                </View>
                              </>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.categoryProductsLabel}>Todos los artículos</Text>
              </View>
            ) : (
              <View style={styles.listHeaderContainer}>
                {/* Mezcla de banners de todas las categorías en mosaico */}
                <Text style={styles.categoryMosaicsTitle}>📂 Nuestras Secciones</Text>
                <View style={[styles.mosaicsGrid, isDesktop && styles.mosaicsGridDesktop]}>
                  {ALL_PRODUCT_CATEGORIES.map((cat) => {
                    const bannerUrl = categoryBanners[cat] || '';
                    const label = categoryNames[cat] || CATEGORY_LABELS[cat];
                    const iconName = CATEGORY_ICONS[cat];
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.mosaicCard, isDesktop ? styles.mosaicCardDesktop : styles.mosaicCardMobile]}
                        onPress={() => setSelectedCategory(cat)}
                        activeOpacity={0.85}
                      >
                        {bannerUrl ? (
                          <Image
                            source={{ uri: bannerUrl }}
                            style={StyleSheet.absoluteFill}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#F1F5F9' }]} />
                        )}
                        <View style={styles.mosaicOverlay} />
                        <View style={styles.mosaicContent}>
                          <MaterialCommunityIcons name={iconName as any} size={22} color="#fff" />
                          <Text style={styles.mosaicTitle}>{label}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.categoryProductsLabel}>Catálogo Completo</Text>
              </View>
            )
          }

          ListFooterComponent={renderPaginationFooter}
        />
      )}

      {/* ── Modal Detalle de Producto ── */}
      {selectedProductDetails && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedProductDetails(null)}>
              <MaterialCommunityIcons name="close" size={24} color="#64748b" />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>
              {/* Image box */}
              <View style={styles.modalImageWrapper}>
                {selectedProductDetails.imagen ? (
                  <Image source={{ uri: selectedProductDetails.imagen }} style={styles.modalImage} resizeMode="contain" />
                ) : (
                  <MaterialCommunityIcons name={CATEGORY_ICONS[selectedProductDetails.categoria] as any} size={88} color={Colors.primary} />
                )}
              </View>

              {/* Text detail */}
              <View style={styles.modalTextDetails}>
                <Text style={styles.modalCode}>{selectedProductDetails.codigo}</Text>
                <Text style={styles.modalName}>{selectedProductDetails.nombre}</Text>
                <Text style={styles.modalPresentacion}>
                  {selectedProductDetails.presentacion} · por {selectedProductDetails.unidad}
                </Text>
                {isLoggedIn ? (
                  <Text style={styles.modalPrice}>{formatPrice(selectedProductDetails.precio)}</Text>
                ) : (
                  <View style={styles.modalPublicPriceBox}>
                    <Text style={styles.modalPublicPriceText}>Registrate para ver precios</Text>
                    <View style={styles.modalPublicPriceButtons}>
                      <TouchableOpacity
                        style={styles.modalPublicLoginBtn}
                        onPress={() => {
                          setSelectedProductDetails(null);
                          router.push({ pathname: '/(tabs)', params: { tab: 'login' } });
                        }}
                      >
                        <Text style={styles.modalPublicLoginBtnText}>Iniciar sesión</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.modalPublicRegisterBtn}
                        onPress={() => {
                          setSelectedProductDetails(null);
                          router.push({ pathname: '/(tabs)', params: { tab: 'register' } });
                        }}
                      >
                        <Text style={styles.modalPublicRegisterBtnText}>Registrarme</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={styles.modalDivider} />

                {/* Description info */}
                <Text style={styles.modalDescTitle}>Descripción del Producto</Text>
                <Text style={styles.modalDescText}>
                  {selectedProductDetails.descripcion && selectedProductDetails.descripcion.trim() !== ''
                    ? selectedProductDetails.descripcion
                    : 'Este producto no posee descripción.'}
                </Text>
              </View>
            </ScrollView>

            {/* Bottom action bar */}
            {isLoggedIn && (
              <View style={styles.modalActionBar}>
                {selectedProductDetails.precio && selectedProductDetails.precio > 0 ? (
                  <TouchableOpacity
                    style={styles.modalBuyButton}
                    onPress={() => {
                      addProduct(selectedProductDetails);
                      setSelectedProductDetails(null);
                    }}
                  >
                    <MaterialCommunityIcons name="cart-plus" size={22} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.modalBuyButtonText}>Agregar al Pedido</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.modalBuyButton, { backgroundColor: '#e2e8f0' }]}>
                    <MaterialCommunityIcons name="tag-off-outline" size={20} color="#94a3b8" style={{ marginRight: 8 }} />
                    <Text style={[styles.modalBuyButtonText, { color: '#94a3b8' }]}>Precio no disponible</Text>
                  </View>
                )}
              </View>
            )}

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

  // ── Header ──
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  searchBar: {
    marginBottom: Spacing.lg,
  },

  // Reorganized Header Styles
  desktopHeaderRow: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 100,
    position: 'relative',
  },
  desktopHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  desktopLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.xl,
    gap: Spacing.xl,
  },
  desktopSearchWrapper: {
    flex: 1,
    maxWidth: 500,
  },
  desktopRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  mobileHeaderContainer: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    zIndex: 100,
    position: 'relative',
  },
  mobileHeaderContent: {
    gap: Spacing.sm,
  },
  mobileTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  mobileSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  filterBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  filterBtnCompactText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  filterBtnCompactMobile: {
    backgroundColor: '#F1F5F9',
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterDropdownPanel: {
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    padding: Spacing.lg,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  },
  filterDropdownPanelDesktop: {
    position: 'absolute',
    top: '100%',
    right: Spacing.xl,
    width: 480,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    marginTop: 4,
  },
  dropdownSectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  dropdownCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  dropdownCategoriesScroll: {
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  headerLoginBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLoginBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  headerRegisterBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRegisterBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },
  mobileHeaderAuthRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  modalPublicPriceBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  modalPublicPriceText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    textAlign: 'center',
  },
  modalPublicPriceButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modalPublicLoginBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPublicLoginBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  modalPublicRegisterBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPublicRegisterBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.white,
  },

  // ── Filtros ──
  categoryFilters: {
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingRight: Spacing.xl,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  categoryChipSelected: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  categoryChipIcon: {
    fontSize: 16,
  },
  categoryChipLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.textSecondary,
  },
  categoryChipLabelSelected: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  // ── Lista ──
  productList: {
    padding: LIST_PADDING,
    paddingBottom: 100,
  },
  productRow: {
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  productCard: {
    flex: 1,
    minHeight: CARD_HEIGHT,
  },

  // ── Empty state ──
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.huge,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // ── Footer ──
  listFooter: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  listFooterText: {
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
    textAlign: 'center',
  },

  // ── Category Banners & Portadas ──
  listHeaderContainer: {
    marginBottom: Spacing.md,
  },
  backBarFixed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
  },
  backBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  backBarBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  backBarCategory: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  backToCategoriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backToCategoriesBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  coverBannerCard: {
    height: 140,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  coverBannerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  coverBannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  coverBannerContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    zIndex: 2,
  },
  coverBannerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  coverBannerSub: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },

  // Category Offers
  categoryOffersSection: {
    marginBottom: Spacing.xl,
  },
  categoryOffersTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#FF1744',
    marginBottom: Spacing.md,
    letterSpacing: 0.5,
  },
  categoryOffersScroll: {
    gap: Spacing.md,
  },
  categoryOfferCard: {
    width: 200,
    backgroundColor: '#1a0a0a',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: '#FF1744',
    position: 'relative',
  },
  offerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF1744',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  offerBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  offerName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: '#fff',
    marginRight: 24,
    marginBottom: 4,
  },
  offerItems: {
    marginBottom: Spacing.sm,
  },
  offerItemText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 14,
  },
  offerPrices: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  offerOriginal: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.4)',
    textDecorationLine: 'line-through',
  },
  offerPromo: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
    color: '#FFD700',
  },
  offerBuyBtn: {
    backgroundColor: '#FF1744',
    borderRadius: Radius.md,
    paddingVertical: 8,
    alignItems: 'center',
  },
  offerBuyBtnText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  categoryProductsLabel: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  // ── Ordenamiento ──
  sortContainer: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 6,
  },
  sortScroll: {
    gap: 8,
    paddingRight: Spacing.lg,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.md,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sortChipActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderColor: Colors.primary,
  },
  sortChipText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  sortChipTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },

  // ── Mosaico de categorías (Todos) ──
  categoryMosaicsTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginVertical: Spacing.md,
  },
  mosaicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: Spacing.xl,
  },
  mosaicsGridDesktop: {
    gap: 16,
  },
  mosaicCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    position: 'relative',
    height: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  mosaicCardMobile: {
    width: '47%', // 2 columns
  },
  mosaicCardDesktop: {
    width: '23.5%', // 4 columns
    height: 120,
  },
  mosaicOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  mosaicContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
    zIndex: 2,
    gap: 6,
  },
  mosaicTitle: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },

  // ── Modal de Detalle de Producto ──
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: Radius.xl,
    width: '90%',
    maxHeight: '85%',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  modalContentDesktop: {
    width: 600,
    maxHeight: '80%',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    padding: 6,
  },
  modalScrollContent: {
    padding: Spacing.xl,
  },
  modalImageWrapper: {
    height: 220,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    position: 'relative',
  },
  modalImage: {
    width: '90%',
    height: '90%',
  },
  modalTextDetails: {
    gap: 6,
  },
  modalCode: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    fontWeight: FontWeight.semibold,
    textTransform: 'uppercase',
  },
  modalName: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  modalPresentacion: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  modalPrice: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    marginTop: 6,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: Spacing.xl,
  },
  modalDescTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  modalDescText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  modalActionBar: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  modalBuyButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    height: 54,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  modalBuyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: FontWeight.bold,
  },
  publicOfferPriceText: {
    fontSize: FontSize.sm - 2,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    textAlign: 'center',
    width: '100%',
  },
  publicOfferCardButtons: {
    flexDirection: 'row',
    gap: 4,
    marginTop: Spacing.sm,
    width: '100%',
  },
  publicOfferLoginBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publicOfferLoginBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  publicOfferRegisterBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publicOfferRegisterBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.white,
  },
  mobileHeaderCartBtn: {
    position: 'relative',
    padding: 8,
    marginRight: 4,
  },
  mobileHeaderCartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileHeaderCartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Estilos de Paginación
  paginationWrapper: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: Spacing.md,
  },
  paginationInfoText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  paginationHighlight: {
    fontWeight: '700',
    color: Colors.primary,
  },
  paginationTotalText: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  paginationControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  paginationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  paginationBtnDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  paginationBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  paginationBtnTextDisabled: {
    color: '#94A3B8',
  },
  paginationNumberBtn: {
    minWidth: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  paginationNumberBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  paginationNumberText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  paginationNumberTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  paginationEllipsis: {
    fontSize: 14,
    color: '#94A3B8',
    paddingHorizontal: 2,
  },
});
