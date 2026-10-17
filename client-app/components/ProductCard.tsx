import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Animated,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Product } from '../types';
import { Colors } from '../constants/Colors';
import { FontSize, FontWeight } from '../constants/Typography';
import { Radius, Spacing } from '../constants/Spacing';
import { formatPrice } from '../utils/formatters';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { useListsStore } from '../store/listsStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { CATEGORY_ICONS } from '../types';
import MaterialCommunityIcons from './icons/MaterialCommunityIcons';
import { useEntrance } from '../hooks/useEntrance';
import { AddToListModal } from './ui/AddToListModal';
import { HoverImagePreview } from './ui/HoverImagePreview';

interface ProductCardProps {
  product: Product;
  style?: ViewStyle;
  onPress?: (product: Product) => void;
  delay?: number;
}

export function ProductCard({ product, style, onPress, delay = 0 }: ProductCardProps) {
  const router = useRouter();
  const { isLoggedIn } = useAuthStore();
  const { addProduct, getItemQuantity, updateQuantity } = useCartStore();
  const isProductInAnyList = useListsStore((state) => state.isProductInAnyList);
  const inAnyList = isProductInAnyList(product.id);
  const [showListModal, setShowListModal] = useState(false);

  const quantity = getItemQuantity(product.id);
  const icon = CATEGORY_ICONS[product.categoria];
  const isInCart = quantity > 0;
  const { animatedStyle } = useEntrance({ delay });

  const productImages = useMemo(() => {
    const pool = [
      product.imagen,
      product.imagenSecundaria,
      ...(Array.isArray(product.imagenes) ? product.imagenes : []),
    ];
    return Array.from(new Set(pool.filter((img): img is string => typeof img === 'string' && img.trim().length > 0)));
  }, [product.imagen, product.imagenSecundaria, product.imagenes]);

  const mainImageUri = productImages[0] || product.imagen;

  const [inputVal, setInputVal] = useState(String(quantity));

  useEffect(() => {
    setInputVal(String(quantity));
  }, [quantity]);

  const commitQty = () => {
    const parsed = parseInt(inputVal, 10);
    if (isNaN(parsed) || parsed <= 0) {
      if (parsed === 0) {
        updateQuantity(product.id, 0);
      } else {
        setInputVal(String(quantity));
      }
    } else if (parsed !== quantity) {
      updateQuantity(product.id, parsed);
    }
  };

  const handleIncrease = () => {
    const current = parseInt(inputVal, 10);
    const nextVal = (isNaN(current) ? quantity : current) + 1;
    setInputVal(String(nextVal));
    updateQuantity(product.id, nextVal);
  };

  const handleDecrease = () => {
    const current = parseInt(inputVal, 10);
    const nextVal = (isNaN(current) ? quantity : current) - 1;
    if (nextVal <= 0) {
      updateQuantity(product.id, 0);
    } else {
      setInputVal(String(nextVal));
      updateQuantity(product.id, nextVal);
    }
  };

  return (
    <Animated.View style={[animatedStyle, styles.wrapper]}>
      <TouchableOpacity
        style={[styles.card, isInCart && styles.cardInCart, style]}
        onPress={() => {
          if (onPress) {
            onPress(product);
          } else {
            router.push(`/producto/${product.id}` as any);
          }
        }}
        activeOpacity={0.88}
      >
        {/* Imagen/placeholder con gradiente suave */}
        <View style={[styles.imageContainer, isInCart && styles.imageContainerInCart]}>
          {mainImageUri ? (
            <HoverImagePreview
              imageUri={mainImageUri}
              images={productImages}
              name={product.nombre}
              price={product.precio}
              presentation={product.presentacion}
              codigo={product.codigo}
              style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
            >
              <Image
                source={{ uri: mainImageUri }}
                style={styles.productImage}
                resizeMode="contain"
              />
            </HoverImagePreview>
          ) : (
            <MaterialCommunityIcons name={icon as any} size={44} color={Colors.primary} />
          )}

          {/* Botón Guardar en Mis Listas */}
          <TouchableOpacity
            style={[styles.listBookmarkBtn, inAnyList && styles.listBookmarkBtnActive]}
            onPress={(e) => {
              e.stopPropagation();
              if (!isLoggedIn) {
                useNotificationStore.getState().showToast({
                  message: 'Iniciá sesión para guardar productos en tus listas.',
                  type: 'warning',
                });
                return;
              }
              setShowListModal(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.78}
            accessibilityLabel="Guardar en mis listas"
          >
            <MaterialCommunityIcons
              name={inAnyList ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={inAnyList ? Colors.primary : '#64748B'}
            />
          </TouchableOpacity>

          {/* Indicador de cantidad en carrito */}
          {isInCart && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{quantity}</Text>
            </View>
          )}
          {/* Overlay decorativo */}
          <View style={styles.imageOverlay} />
        </View>

        {/* Info del producto */}
        <View style={styles.info}>
          <View>
            <Text style={styles.codigo}>{product.codigo}</Text>
            <Text style={styles.nombre} numberOfLines={2}>
              {product.nombre}
            </Text>
            {product.presentacion ? (
              <Text style={styles.presentacion} numberOfLines={1}>
                {product.presentacion}
              </Text>
            ) : (
              <Text style={[styles.presentacion, { opacity: 0 }]} numberOfLines={1}>
                -
              </Text>
            )}
            <Text style={styles.unidad}>por {product.unidad}</Text>
          </View>

          {/* Footer: precio Lista 1 (minorista) + controles de compra */}
          <View style={styles.footer}>
            <View style={styles.priceContainer}>
              <Text style={[styles.precio, (!product.precio || product.precio <= 0) && styles.sinPrecio]}>
                {product.precio && product.precio > 0 ? formatPrice(product.precio) : 'Sin precio'}
              </Text>
              <Text style={styles.priceListTag}>Lista 1 · Minorista</Text>
            </View>

            {/* Botón "COMPRAR" o control +/− */}
            {(!product.precio || product.precio <= 0) ? (
              <View style={styles.sinPrecioBtn}>
                <Text style={styles.sinPrecioBtnText}>No disponible</Text>
              </View>
            ) : quantity === 0 ? (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => addProduct(product)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel={`Comprar ${product.nombre}`}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="cart-outline" size={16} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.addButtonText}>COMPRAR</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.quantityControl} onStartShouldSetResponder={() => true}>
                <TouchableOpacity
                  style={styles.qtyButton}
                  onPress={handleDecrease}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Quitar uno"
                >
                  <Text style={styles.qtyButtonText}>−</Text>
                </TouchableOpacity>

                <TextInput
                  style={styles.qtyInput}
                  value={inputVal}
                  onChangeText={(text) => {
                    const cleaned = text.replace(/[^0-9]/g, '');
                    setInputVal(cleaned);
                  }}
                  onBlur={commitQty}
                  onSubmitEditing={commitQty}
                  keyboardType="numeric"
                  selectTextOnFocus
                  returnKeyType="done"
                  maxLength={5}
                />

                <TouchableOpacity
                  style={[styles.qtyButton, styles.qtyButtonAdd]}
                  onPress={handleIncrease}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Agregar uno más"
                >
                  <Text style={[styles.qtyButtonText, styles.qtyButtonAddText]}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <AddToListModal
        visible={showListModal}
        product={product}
        onClose={() => setShowListModal(false)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    flex: 1,
    minHeight: 280,
    elevation: 0,
    shadowOpacity: 0,
  },
  cardInCart: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
  },
  imageContainer: {
    height: 130,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageContainerInCart: {
    backgroundColor: '#F8FAFC',
  },
  imageOverlay: {
    display: 'none',
  },
  listBookmarkBtn: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 28,
    height: 28,
    borderRadius: Radius.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 10,
  },
  listBookmarkBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.primary,
  },
  cartBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: Colors.primary,
    borderRadius: Radius.xs,
    minWidth: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  info: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
    gap: 6,
  },
  codigo: {
    fontSize: 10,
    color: Colors.textDisabled,
    fontWeight: FontWeight.medium,
    marginBottom: 2,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  nombre: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
    lineHeight: 17,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  presentacion: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    marginBottom: 2,
    textAlign: 'center',
  },
  unidad: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    marginBottom: 4,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    gap: 6,
    width: '100%',
  },
  priceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  precio: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.primary,
    textAlign: 'center',
  },
  priceListTag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
    letterSpacing: 0.3,
  },

  // Botón "COMPRAR"
  addButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    height: 36,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Control +/−
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.primary,
    width: '100%',
    height: 36,
  },
  qtyButton: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  qtyButtonAdd: {
    backgroundColor: Colors.primary,
  },
  qtyButtonText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    lineHeight: 22,
  },
  qtyButtonAddText: {
    color: Colors.white,
  },
  qtyInput: {
    fontSize: 14,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    minWidth: 40,
    height: 36,
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
  },
  // Sin precio
  sinPrecio: {
    color: Colors.textDisabled,
    fontSize: FontSize.sm,
  },
  sinPrecioBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 38,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sinPrecioBtnText: {
    color: Colors.textDisabled,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
});
