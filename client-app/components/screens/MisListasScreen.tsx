import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Image,
  RefreshControl,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { formatPrice } from '../../utils/formatters';
import { useListsStore } from '../../store/listsStore';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { ListaDetalleScreen } from './ListaDetalleScreen';
import { AddToListModal } from '../ui/AddToListModal';
import { Product } from '../../types';
import { supabase } from '@shared/services/supabaseClient';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';

interface MisListasScreenProps {
  onBackToAccount?: () => void;
}

export function MisListasScreen({ onBackToAccount }: MisListasScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  const { isLoggedIn } = useAuthStore();
  const {
    lists,
    isLoading,
    fetchLists,
    createList,
    addItemToList,
    isProductInList,
    activeListId,
    setActiveListId,
  } = useListsStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Buscador de productos (no precargado)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Lista seleccionada para agregar directamente desde la búsqueda
  const [focusedTargetListId, setFocusedTargetListId] = useState<string | number | null>(null);

  // Modal contextual cuando hay múltiples listas
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [showMultiListModal, setShowMultiListModal] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      fetchLists();
    }
  }, [isLoggedIn]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLists();
    setIsRefreshing(false);
  };

  const handleCreate = async () => {
    if (!newNombre.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await createList(newNombre.trim(), newDesc.trim() || undefined);
      if (created) {
        setShowCreateModal(false);
        setNewNombre('');
        setNewDesc('');
        setActiveListId(created.id);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Búsqueda bajo demanda (solo cuando se presiona Buscar)
  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, codigo, nombre, descripcion, presentacion, precio, unidad, categoria, subcategoria, stock, imagen, destacado, activo, marca')
        .eq('activo', true)
        .or(`nombre.ilike.%${q}%,codigo.ilike.%${q}%,descripcion.ilike.%${q}%,presentacion.ilike.%${q}%`)
        .limit(30);

      if (error) {
        console.error('Error al buscar productos para listas:', error);
        setSearchResults([]);
      } else {
        setSearchResults((data as any[]) || []);
      }
    } catch (err) {
      console.error('Error en búsqueda de productos:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Manejo del botón "+" en los productos buscados
  const handleAddProductFromSearch = async (product: Product) => {
    // 1. Si hay una lista enfocada (por el botón "Agregar productos a esta lista")
    if (focusedTargetListId !== null) {
      await addItemToList(focusedTargetListId, product);
      return;
    }

    // 2. Si no hay lista enfocada:
    if (lists.length === 0) {
      useNotificationStore.getState().showToast({
        message: 'Creá una lista primero para poder agregar productos.',
        type: 'warning',
      });
      setShowCreateModal(true);
      return;
    }

    // Si tiene una sola lista, se agrega directamente a esa lista
    if (lists.length === 1) {
      await addItemToList(lists[0].id, product);
      return;
    }

    // Si tiene más de una lista, abrir contextual con checkboxes
    setSelectedProductForModal(product);
    setShowMultiListModal(true);
  };

  // Si hay una lista activa seleccionada, mostramos la pantalla de detalle de esa lista
  if (activeListId !== null) {
    return (
      <ListaDetalleScreen
        listId={activeListId}
        onBack={() => setActiveListId(null)}
      />
    );
  }

  const focusedTargetList = lists.find((l) => String(l.id) === String(focusedTargetListId));

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        {onBackToAccount ? (
          <TouchableOpacity style={styles.backBtn} onPress={onBackToAccount} activeOpacity={0.7}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
            <Text style={styles.backBtnText}>Mi Cuenta</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons name="bookmark-multiple" size={26} color={Colors.primary} />
            <Text style={styles.title}>Mis Listas</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="plus" size={18} color={Colors.white} />
          <Text style={styles.createBtnText}>Nueva Lista</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {/* Banner explicativo */}
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Tus listas personalizadas de compras</Text>
          <Text style={styles.bannerSub}>
            Armá listas con tus productos habituales para agregarlos al carrito con un solo toque y no olvidarte de nada.
          </Text>
        </View>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* BUSCADOR CON LUPA (No precargado, busca al tocar Buscar) */}
        {/* ─────────────────────────────────────────────────────────── */}
        <View style={styles.searchCard}>
          {focusedTargetList && (
            <View style={styles.focusedBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <MaterialCommunityIcons name="playlist-check" size={20} color={Colors.primary} />
                <Text style={styles.focusedBannerText} numberOfLines={1}>
                  Agregando productos a: <Text style={{ fontWeight: 'bold' }}>{focusedTargetList.nombre}</Text>
                </Text>
              </View>
              <TouchableOpacity
                style={styles.focusedClearBtn}
                onPress={() => setFocusedTargetListId(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.focusedClearBtnText}>✕ Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.searchSectionTitle}>
            🔍 Buscar productos para agregar a tus listas
          </Text>

          <View style={styles.searchBarRow}>
            <View style={styles.searchInputWrapper}>
              <MaterialCommunityIcons name="magnify" size={20} color={Colors.textDisabled} />
              <TextInput
                style={styles.searchInput}
                placeholder="Escribí nombre o código y tocá Buscar..."
                placeholderTextColor={Colors.textDisabled}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                  }}
                  style={{ padding: 4 }}
                >
                  <MaterialCommunityIcons name="close-circle" size={18} color={Colors.textDisabled} />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.searchBtn, (!searchQuery.trim() || isSearching) && styles.searchBtnDisabled]}
              onPress={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
              activeOpacity={0.8}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialCommunityIcons name="magnify" size={18} color={Colors.white} />
                  <Text style={styles.searchBtnText}>Buscar</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Resultados de búsqueda */}
          {searchResults !== null && (
            <View style={styles.resultsContainer}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                  {searchResults.length} {searchResults.length === 1 ? 'producto encontrado' : 'productos encontrados'}
                </Text>
                <TouchableOpacity onPress={() => setSearchResults(null)}>
                  <Text style={styles.closeResultsLink}>Cerrar resultados ✕</Text>
                </TouchableOpacity>
              </View>

              {searchResults.length === 0 ? (
                <View style={styles.noResultsBox}>
                  <Text style={styles.noResultsText}>
                    No se encontraron productos para "{searchQuery}".
                  </Text>
                </View>
              ) : (
                <View style={styles.resultsList}>
                  {searchResults.map((prod) => {
                    // Si hay lista enfocada, verificar si ya está en esa lista
                    const inFocused = focusedTargetListId ? isProductInList(focusedTargetListId, prod.id) : false;

                    return (
                      <View key={prod.id} style={styles.resultItemRow}>
                        {/* Foto pequeña */}
                        {prod.imagen ? (
                          <Image source={{ uri: prod.imagen }} style={styles.resultThumb} resizeMode="contain" />
                        ) : (
                          <View style={styles.resultThumbPlaceholder}>
                            <MaterialCommunityIcons name="cube-outline" size={20} color={Colors.primary} />
                          </View>
                        )}

                        {/* Info producto */}
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultName} numberOfLines={1}>
                            {prod.nombre}
                          </Text>
                          <Text style={styles.resultMeta}>
                            {prod.presentacion || prod.codigo} • {prod.precio > 0 ? formatPrice(prod.precio) : 'Sin precio'}
                          </Text>
                        </View>

                        {/* Botón + */}
                        <TouchableOpacity
                          style={[styles.resultAddBtn, inFocused && styles.resultAddBtnInList]}
                          onPress={() => handleAddProductFromSearch(prod)}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons
                            name={inFocused ? 'check' : 'plus'}
                            size={18}
                            color={Colors.white}
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* LISTADO DE LISTAS CREADAS */}
        {/* ─────────────────────────────────────────────────────────── */}
        <View style={{ marginTop: 6 }}>
          <Text style={styles.sectionHeaderTitle}>Tus Listas ({lists.length})</Text>
        </View>

        {isLoading && lists.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Cargando tus listas...</Text>
          </View>
        ) : lists.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBox}>
              <MaterialCommunityIcons name="playlist-plus" size={44} color={Colors.primary} />
            </View>
            <Text style={styles.emptyHeading}>No tenés listas creadas</Text>
            <Text style={styles.emptyDesc}>
              Creá tu primera lista como "Compras Semanales", "Limpieza Oficina" o "Favoritos" para agilizar tus pedidos.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={18} color={Colors.white} />
              <Text style={styles.emptyActionBtnText}>Crear primera lista</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listsGrid}>
            {lists.map((list) => {
              const previewItems = list.items.slice(0, 4);
              const isTargetActive = String(focusedTargetListId) === String(list.id);

              return (
                <View
                  key={list.id}
                  style={[styles.listCard, isTargetActive && styles.listCardFocused]}
                >
                  <TouchableOpacity
                    onPress={() => setActiveListId(list.id)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {list.nombre}
                        </Text>
                        {list.descripcion ? (
                          <Text style={styles.cardDesc} numberOfLines={2}>
                            {list.descripcion}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.counterBadge}>
                        <Text style={styles.counterBadgeText}>
                          {list.items.length} {list.items.length === 1 ? 'ítem' : 'ítems'}
                        </Text>
                      </View>
                    </View>

                    {/* Previews de productos */}
                    {list.items.length > 0 ? (
                      <View style={styles.previewRow}>
                        {previewItems.map((it, idx) => (
                          <View key={it.id || idx} style={styles.previewThumbBox}>
                            {it.product?.imagen ? (
                              <Image
                                source={{ uri: it.product.imagen }}
                                style={styles.previewThumbImg}
                                resizeMode="contain"
                              />
                            ) : (
                              <MaterialCommunityIcons name="cube-outline" size={18} color={Colors.primary} />
                            )}
                          </View>
                        ))}
                        {list.items.length > 4 && (
                          <View style={[styles.previewThumbBox, styles.previewThumbMore]}>
                            <Text style={styles.previewThumbMoreText}>+{list.items.length - 4}</Text>
                          </View>
                        )}
                      </View>
                    ) : (
                      <View style={styles.noItemsBox}>
                        <Text style={styles.noItemsText}>Sin productos guardados aún</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Acciones de la tarjeta */}
                  <View style={styles.cardFooter}>
                    {/* Botón requerido: "Agregar productos a esta lista" */}
                    <TouchableOpacity
                      style={[
                        styles.addProductsDirectBtn,
                        isTargetActive && styles.addProductsDirectBtnActive,
                      ]}
                      onPress={() => {
                        if (isTargetActive) {
                          setFocusedTargetListId(null);
                        } else {
                          setFocusedTargetListId(list.id);
                          scrollRef.current?.scrollTo({ y: 0, animated: true });
                          useNotificationStore.getState().showToast({
                            message: `Buscá productos con la lupa para agregarlos directamente a "${list.nombre}".`,
                            type: 'info',
                          });
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons
                        name={isTargetActive ? 'check' : 'plus-circle-outline'}
                        size={16}
                        color={isTargetActive ? Colors.white : Colors.primary}
                      />
                      <Text
                        style={[
                          styles.addProductsDirectBtnText,
                          isTargetActive && styles.addProductsDirectBtnTextActive,
                        ]}
                      >
                        {isTargetActive ? 'Agregando productos aquí' : 'Agregar productos a esta lista'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setActiveListId(list.id)}
                      activeOpacity={0.7}
                      style={{ paddingVertical: 4, paddingHorizontal: 6 }}
                    >
                      <Text style={styles.viewListLink}>Ver detalle ›</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal contextual con checkboxes cuando hay más de una lista */}
      <AddToListModal
        visible={showMultiListModal}
        product={selectedProductForModal}
        onClose={() => {
          setShowMultiListModal(false);
          setSelectedProductForModal(null);
        }}
      />

      {/* Modal Crear Lista */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialCommunityIcons name="plus-circle" size={24} color={Colors.primary} />
                <Text style={styles.modalHeading}>Nueva Lista</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nombre de la lista *</Text>
            <TextInput
              style={styles.modalInput}
              value={newNombre}
              onChangeText={setNewNombre}
              placeholder="Ej: Pedido Mensual, Limpieza Hogar..."
              placeholderTextColor={Colors.textDisabled}
              autoFocus
            />

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Descripción (opcional)</Text>
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Ej: Artículos necesarios para el primer lunes de cada mes"
              placeholderTextColor={Colors.textDisabled}
              multiline
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCreateModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, !newNombre.trim() && { opacity: 0.5 }]}
                onPress={handleCreate}
                disabled={!newNombre.trim() || isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Crear Lista</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  backBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
  },
  createBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  banner: {
    backgroundColor: '#EFF6FF',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  bannerTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginBottom: 4,
  },
  bannerSub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Buscador con lupa
  searchCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  focusedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 4,
  },
  focusedBannerText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  focusedClearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  focusedClearBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.danger,
  },
  searchSectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  searchBarRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    gap: 8,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnDisabled: {
    opacity: 0.6,
  },
  searchBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  resultsContainer: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultsCount: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
  },
  closeResultsLink: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: FontWeight.bold,
  },
  noResultsBox: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  resultsList: {
    gap: 8,
    maxHeight: 280,
  },
  resultItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  resultThumb: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Colors.white,
  },
  resultThumbPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  resultMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  resultAddBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultAddBtnInList: {
    backgroundColor: Colors.success,
  },

  sectionHeaderTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  emptyHeading: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Radius.md,
  },
  emptyActionBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  listsGrid: {
    gap: Spacing.md,
  },
  listCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  listCardFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: '#F8FAFC',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  counterBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  counterBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  previewThumbBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  previewThumbImg: {
    width: '100%',
    height: '100%',
  },
  previewThumbMore: {
    backgroundColor: Colors.surfaceAlt,
  },
  previewThumbMoreText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textSecondary,
  },
  noItemsBox: {
    marginTop: 10,
    paddingVertical: 6,
  },
  noItemsText: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    fontStyle: 'italic',
  },
  cardFooter: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  addProductsDirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  addProductsDirectBtnActive: {
    backgroundColor: Colors.primary,
  },
  addProductsDirectBtnText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  addProductsDirectBtnTextActive: {
    color: Colors.white,
  },
  viewListLink: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  closeBtn: {
    padding: 4,
  },
  modalHeading: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
  },
  modalCancelBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  modalSaveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
  },
  modalSaveBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
