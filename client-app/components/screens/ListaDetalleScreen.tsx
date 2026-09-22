import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { formatPrice } from '../../utils/formatters';
import { useListsStore } from '../../store/listsStore';
import { useCartStore } from '../../store/cartStore';
import { Product } from '../../types';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';

interface ListaDetalleScreenProps {
  listId: string | number;
  onBack: () => void;
}

export function ListaDetalleScreen({ listId, onBack }: ListaDetalleScreenProps) {
  const router = useRouter();
  const {
    lists,
    updateList,
    deleteList,
    removeItemFromList,
    addListToCart,
    addSingleProductToCart,
    getCartConflicts,
  } = useListsStore();

  const currentList = lists.find((l) => String(l.id) === String(listId));
  const cartItems = useCartStore((state) => state.items);

  // Estados de edición de lista
  const [isEditing, setIsEditing] = useState(false);
  const [editNombre, setEditNombre] = useState(currentList?.nombre || '');
  const [editDesc, setEditDesc] = useState(currentList?.descripcion || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modal de confirmación de eliminación
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Modal de resolución de conflictos de carrito
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictProducts, setConflictProducts] = useState<Product[]>([]);
  const [pendingCartAction, setPendingCartAction] = useState<'add' | 'replace' | null>(null);

  // Modal de conflicto para un producto individual
  const [singleConflictProduct, setSingleConflictProduct] = useState<Product | null>(null);

  if (!currentList) {
    return (
      <View style={styles.notFoundContainer}>
        <Text style={styles.notFoundText}>No se encontró la lista solicitada.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Volver a Mis Listas</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const items = currentList.items;

  // Acciones de carrito global con detección de conflictos
  const handleTriggerAddAll = () => {
    const conflicts = getCartConflicts(listId);
    if (conflicts.length > 0) {
      setConflictProducts(conflicts);
      setPendingCartAction('add');
      setShowConflictModal(true);
    } else {
      addListToCart(listId, 'add');
    }
  };

  const handleTriggerReplaceAll = () => {
    const conflicts = getCartConflicts(listId);
    if (conflicts.length > 0) {
      setConflictProducts(conflicts);
      setPendingCartAction('replace');
      setShowConflictModal(true);
    } else {
      addListToCart(listId, 'replace');
    }
  };

  // Agregar producto individual al carrito
  const handleAddSingleProduct = (product: Product) => {
    const inCart = cartItems.some((ci) => String(ci.producto.id) === String(product.id));
    if (inCart) {
      setSingleConflictProduct(product);
    } else {
      addSingleProductToCart(product, 'add');
    }
  };

  const handleSaveEdit = async () => {
    if (!editNombre.trim()) return;
    setIsSavingEdit(true);
    try {
      await updateList(listId, editNombre.trim(), editDesc.trim() || undefined);
      setIsEditing(false);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    await deleteList(listId);
    setShowDeleteConfirm(false);
    onBack();
  };

  return (
    <View style={styles.container}>
      {/* Barra superior con volver y acciones */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backArrowBtn} onPress={onBack} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.textPrimary} />
          <Text style={styles.backArrowText}>Mis Listas</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.iconActionBtn}
            onPress={() => {
              setEditNombre(currentList.nombre);
              setEditDesc(currentList.descripcion || '');
              setIsEditing(true);
            }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="pencil-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconActionBtn, { backgroundColor: '#FEE2E2' }]}
            onPress={() => setShowDeleteConfirm(true)}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Encabezado de la lista */}
        <View style={styles.headerCard}>
          <View style={styles.badgeRow}>
            <View style={styles.itemBadge}>
              <MaterialCommunityIcons name="format-list-bulleted" size={16} color={Colors.primary} />
              <Text style={styles.itemBadgeText}>
                {items.length} {items.length === 1 ? 'producto' : 'productos'}
              </Text>
            </View>
          </View>

          <Text style={styles.listTitle}>{currentList.nombre}</Text>
          {currentList.descripcion ? (
            <Text style={styles.listDesc}>{currentList.descripcion}</Text>
          ) : null}

          {/* Botones de acción masiva sobre el carrito */}
          {items.length > 0 && (
            <View style={styles.cartActionGroup}>
              <TouchableOpacity
                style={styles.btnAddAll}
                onPress={handleTriggerAddAll}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="cart-plus" size={18} color={Colors.white} />
                <Text style={styles.btnAddAllText}>Sumar al carrito</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnReplaceAll}
                onPress={handleTriggerReplaceAll}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="sync" size={18} color={Colors.primary} />
                <Text style={styles.btnReplaceAllText}>Reemplazar carrito</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Lista de productos */}
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="basket-outline" size={54} color={Colors.textDisabled} />
            <Text style={styles.emptyTitle}>Esta lista no tiene productos</Text>
            <Text style={styles.emptySub}>
              Explorá nuestro catálogo y tocá el icono de marcador para guardarlos en esta lista.
            </Text>
            <TouchableOpacity
              style={styles.goToCatalogBtn}
              onPress={() => router.push('/(tabs)/catalogo' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.goToCatalogBtnText}>Ir al Catálogo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.productsList}>
            {items.map((item) => {
              const p = item.product;
              if (!p) return null;
              const inCart = cartItems.some((ci) => String(ci.producto.id) === String(p.id));

              return (
                <View key={item.id} style={styles.productRow}>
                  {/* Imagen */}
                  {p.imagen ? (
                    <Image source={{ uri: p.imagen }} style={styles.productImg} resizeMode="contain" />
                  ) : (
                    <View style={styles.placeholderImg}>
                      <MaterialCommunityIcons name="cube-outline" size={26} color={Colors.primary} />
                    </View>
                  )}

                  {/* Datos del producto */}
                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {p.nombre}
                    </Text>
                    <Text style={styles.productDetails}>
                      {p.presentacion || p.codigo} • por {p.unidad || 'unidad'}
                    </Text>
                    <Text style={styles.productPrice}>
                      {p.precio > 0 ? formatPrice(p.precio) : 'Sin precio'}
                    </Text>
                  </View>

                  {/* Botones de acción */}
                  <View style={styles.rowActions}>
                    <TouchableOpacity
                      style={[styles.btnRowCart, inCart && styles.btnRowCartActive]}
                      onPress={() => handleAddSingleProduct(p)}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons
                        name={inCart ? 'cart-check' : 'cart-plus'}
                        size={18}
                        color={inCart ? Colors.successDark : Colors.primary}
                      />
                      <Text style={[styles.btnRowCartText, inCart && styles.btnRowCartTextActive]}>
                        {inCart ? 'En carrito' : 'Agregar'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnRowRemove}
                      onPress={() => removeItemFromList(listId, p.id)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal Editar Lista */}
      <Modal visible={isEditing} transparent animationType="fade" onRequestClose={() => setIsEditing(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>Editar Lista</Text>
            <TextInput
              style={styles.modalInput}
              value={editNombre}
              onChangeText={setEditNombre}
              placeholder="Nombre de la lista"
              placeholderTextColor={Colors.textDisabled}
            />
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="Descripción opcional"
              placeholderTextColor={Colors.textDisabled}
              multiline
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditing(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, !editNombre.trim() && { opacity: 0.5 }]}
                onPress={handleSaveEdit}
                disabled={!editNombre.trim() || isSavingEdit}
                activeOpacity={0.8}
              >
                {isSavingEdit ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Guardar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Confirmar Eliminar Lista */}
      <Modal visible={showDeleteConfirm} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirm(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>¿Eliminar esta lista?</Text>
            <Text style={styles.modalDesc}>
              Se eliminará "{currentList.nombre}" y los productos guardados en ella. Los productos no se borrarán del catálogo ni de tus pedidos.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDeleteConfirm(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: Colors.danger }]}
                onPress={handleDelete}
                activeOpacity={0.8}
              >
                <Text style={styles.modalSaveBtnText}>Eliminar Lista</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Conflicto Carrito (Masivo) */}
      <Modal visible={showConflictModal} transparent animationType="fade" onRequestClose={() => setShowConflictModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <MaterialCommunityIcons name="alert-circle" size={24} color={Colors.warning} />
              <Text style={styles.modalHeading}>Productos ya en carrito</Text>
            </View>
            <Text style={styles.modalDesc}>
              {conflictProducts.length === 1
                ? `El producto "${conflictProducts[0]?.nombre}" ya se encuentra en tu carrito actual.`
                : `Hay ${conflictProducts.length} productos de esta lista que ya están en tu carrito actual:`}
            </Text>

            <ScrollView style={{ maxHeight: 110, marginVertical: 8, backgroundColor: '#F8FAFC', borderRadius: Radius.sm, padding: 8 }}>
              {conflictProducts.map((p) => (
                <Text key={p.id} style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: 3 }}>
                  • {p.nombre}
                </Text>
              ))}
            </ScrollView>

            <Text style={[styles.modalDesc, { fontWeight: '600', marginBottom: 12 }]}>
              ¿Cómo querés cargarlos en el carrito?
            </Text>

            <View style={{ gap: 8 }}>
              <TouchableOpacity
                style={[styles.conflictActionBtn, { backgroundColor: Colors.primary }]}
                onPress={() => {
                  setShowConflictModal(false);
                  addListToCart(listId, 'add');
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="cart-plus" size={18} color={Colors.white} />
                <Text style={styles.conflictActionBtnText}>
                  Sumar unidades al carrito actual
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.conflictActionBtn, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' }]}
                onPress={() => {
                  setShowConflictModal(false);
                  addListToCart(listId, 'replace');
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="sync" size={18} color={Colors.textPrimary} />
                <Text style={[styles.conflictActionBtnText, { color: Colors.textPrimary }]}>
                  Reemplazar carrito con esta lista
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCancelBtn, { alignSelf: 'center', marginTop: 4 }]}
                onPress={() => setShowConflictModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Conflicto Carrito (Individual) */}
      <Modal visible={!!singleConflictProduct} transparent animationType="fade" onRequestClose={() => setSingleConflictProduct(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <MaterialCommunityIcons name="alert-circle" size={24} color={Colors.warning} />
              <Text style={styles.modalHeading}>Producto ya en el carrito</Text>
            </View>
            <Text style={styles.modalDesc}>
              "{singleConflictProduct?.nombre}" ya está en tu carrito. ¿Deseas sumar una unidad más o fijar la cantidad en 1?
            </Text>

            <View style={{ gap: 8, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.conflictActionBtn, { backgroundColor: Colors.primary }]}
                onPress={() => {
                  if (singleConflictProduct) {
                    addSingleProductToCart(singleConflictProduct, 'add');
                  }
                  setSingleConflictProduct(null);
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="plus" size={18} color={Colors.white} />
                <Text style={styles.conflictActionBtnText}>Sumar +1 al carrito</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.conflictActionBtn, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' }]}
                onPress={() => {
                  if (singleConflictProduct) {
                    addSingleProductToCart(singleConflictProduct, 'replace');
                  }
                  setSingleConflictProduct(null);
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="numeric-1" size={18} color={Colors.textPrimary} />
                <Text style={[styles.conflictActionBtnText, { color: Colors.textPrimary }]}>
                  Fijar cantidad en 1
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalCancelBtn, { alignSelf: 'center', marginTop: 4 }]}
                onPress={() => setSingleConflictProduct(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backArrowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  backArrowText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  headerCard: {
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
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  itemBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  listTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  listDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  cartActionGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexWrap: 'wrap',
  },
  btnAddAll: {
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  btnAddAllText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  btnReplaceAll: {
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  btnReplaceAllText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
  goToCatalogBtn: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: Radius.md,
  },
  goToCatalogBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  productsList: {
    gap: Spacing.md,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  productImg: {
    width: 60,
    height: 60,
    borderRadius: Radius.sm,
    backgroundColor: '#F8FAFC',
  },
  placeholderImg: {
    width: 60,
    height: 60,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  productDetails: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  rowActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  btnRowCart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
  },
  btnRowCartActive: {
    backgroundColor: '#DCFCE7',
  },
  btnRowCartText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  btnRowCartTextActive: {
    color: Colors.successDark,
  },
  btnRowRemove: {
    padding: 4,
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
  modalHeading: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 18,
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
    marginTop: 10,
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
  conflictActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
  },
  conflictActionBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  notFoundText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
  },
  backBtnText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
  },
});
