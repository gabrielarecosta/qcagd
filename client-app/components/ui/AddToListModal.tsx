import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { Product } from '../../types';
import { useListsStore } from '../../store/listsStore';
import { useAuthStore } from '../../store/authStore';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';

interface AddToListModalProps {
  visible: boolean;
  product: Product | null;
  onClose: () => void;
}

export function AddToListModal({ visible, product, onClose }: AddToListModalProps) {
  const { isLoggedIn } = useAuthStore();
  const {
    lists,
    isLoading,
    fetchLists,
    createList,
    addItemToList,
    removeItemFromList,
    isProductInList,
  } = useListsStore();

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (visible && isLoggedIn) {
      fetchLists();
      setIsCreatingNew(false);
      setNewListName('');
      setNewListDesc('');
    }
  }, [visible, isLoggedIn]);

  if (!visible || !product) return null;

  const handleToggleProductInList = async (listId: string | number) => {
    if (isProductInList(listId, product.id)) {
      await removeItemFromList(listId, product.id);
    } else {
      await addItemToList(listId, product);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newListName.trim()) return;
    setIsSubmitting(true);
    try {
      const created = await createList(newListName.trim(), newListDesc.trim() || undefined);
      if (created) {
        await addItemToList(created.id, product);
        setIsCreatingNew(false);
        setNewListName('');
        setNewListDesc('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="bookmark-multiple" size={24} color={Colors.primary} />
              <Text style={styles.title}>Guardar en Mis Listas</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Product info banner */}
          <View style={styles.productBanner}>
            {product.imagen ? (
              <Image source={{ uri: product.imagen }} style={styles.productThumb} resizeMode="contain" />
            ) : (
              <View style={styles.productThumbPlaceholder}>
                <MaterialCommunityIcons name="cube-outline" size={22} color={Colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.productName} numberOfLines={1}>
                {product.nombre}
              </Text>
              <Text style={styles.productMeta}>
                {product.presentacion || product.codigo}
              </Text>
            </View>
          </View>

          {/* Body */}
          {isLoading && lists.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Cargando listas...</Text>
            </View>
          ) : (
            <ScrollView style={styles.listScrollView} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {lists.map((list) => {
                const inThisList = isProductInList(list.id, product.id);
                return (
                  <TouchableOpacity
                    key={list.id}
                    style={[styles.listItemRow, inThisList && styles.listItemRowActive]}
                    onPress={() => handleToggleProductInList(list.id)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.listNameText, inThisList && styles.listNameTextActive]}>
                        {list.nombre}
                      </Text>
                      <Text style={styles.listCountText}>
                        {list.items.length} {list.items.length === 1 ? 'producto' : 'productos'}
                        {list.descripcion ? ` • ${list.descripcion}` : ''}
                      </Text>
                    </View>

                    <View style={[styles.checkCircle, inThisList && styles.checkCircleActive]}>
                      {inThisList && (
                        <MaterialCommunityIcons name="check" size={16} color={Colors.white} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {lists.length === 0 && !isCreatingNew && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Todavía no tenés ninguna lista creada.</Text>
                </View>
              )}

              {/* Form Crear Nueva Lista */}
              {isCreatingNew ? (
                <View style={styles.newFormContainer}>
                  <Text style={styles.newFormTitle}>Crear y agregar a nueva lista</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre de la lista (ej: Compras Quincenales)"
                    placeholderTextColor={Colors.textDisabled}
                    value={newListName}
                    onChangeText={setNewListName}
                    autoFocus
                  />
                  <TextInput
                    style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                    placeholder="Descripción opcional"
                    placeholderTextColor={Colors.textDisabled}
                    value={newListDesc}
                    onChangeText={setNewListDesc}
                    multiline
                  />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setIsCreatingNew(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.cancelBtnText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, !newListName.trim() && { opacity: 0.5 }]}
                      onPress={handleCreateAndAdd}
                      disabled={!newListName.trim() || isSubmitting}
                      activeOpacity={0.8}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <Text style={styles.saveBtnText}>Guardar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addNewListBtn}
                  onPress={() => setIsCreatingNew(true)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons name="plus-circle-outline" size={20} color={Colors.primary} />
                  <Text style={styles.addNewListText}>Crear una nueva lista</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {/* Footer button */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.doneBtnText}>Listo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceAlt,
  },
  productBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.white,
  },
  productThumbPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  productMeta: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  listScrollView: {
    maxHeight: 280,
  },
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  listItemRowActive: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.primary,
  },
  listNameText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  listNameTextActive: {
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  listCountText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  checkCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  addNewListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 6,
  },
  addNewListText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.primary,
  },
  newFormContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
    gap: 8,
  },
  newFormTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.sm,
  },
  cancelBtnText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: Radius.sm,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  footer: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
