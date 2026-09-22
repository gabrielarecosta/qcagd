import React, { useState, useEffect } from 'react';
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
import { useListsStore } from '../../store/listsStore';
import { useAuthStore } from '../../store/authStore';
import { ListaDetalleScreen } from './ListaDetalleScreen';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';

interface MisListasScreenProps {
  onBackToAccount?: () => void;
}

export function MisListasScreen({ onBackToAccount }: MisListasScreenProps) {
  const { isLoggedIn } = useAuthStore();
  const { lists, isLoading, fetchLists, createList, activeListId, setActiveListId } = useListsStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Si hay una lista activa seleccionada, mostramos la pantalla de detalle de esa lista
  if (activeListId !== null) {
    return (
      <ListaDetalleScreen
        listId={activeListId}
        onBack={() => setActiveListId(null)}
      />
    );
  }

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
              return (
                <TouchableOpacity
                  key={list.id}
                  style={styles.listCard}
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

                  {/* Footer de la tarjeta */}
                  <View style={styles.cardFooter}>
                    <Text style={styles.viewListLink}>Ver y gestionar lista ›</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

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
    justifyContent: 'flex-end',
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
