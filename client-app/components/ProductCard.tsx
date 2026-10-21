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
  Platform,
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
  const { isLoggedIn, clientData } = useAuthStore();
  const { addProduct, getItemQuantity, updateQuantity } = useCartStore();
  const isProductInAnyList = useListsStore((state) => state.isProductInAnyList);
  const inAnyList = isProductInAnyList(product.id);
  const [showListModal, setShowListModal] = useState(false);

  // Determinar lista de precios correspondiente según el rol del cliente
  const customerType = clientData?.tipoCliente?.toLowerCase?.() || 'minorista';
  const isMayorista = customerType === 'mayorista';
  const isSocio = customerType === 'socio' || customerType === 'socios';

  let displayPrice = product.precio;
  let priceListTag = 'Lista 1 · Minorista';

  if (isSocio && product.precioSocios && product.precioSocios > 0) {
    displayPrice = product.precioSocios;
    priceListTag = 'Lista 4 · Socio';
  } else if (isMayorista && product.precioMayorista && product.precioMayorista > 0) {
    displayPrice = product.precioMayorista;
    priceListTag = 'Lista 3 · Mayorista';
  }

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
  const [buyQty, setBuyQty] = useState('1');
  const [isInputFocused, setIsInputFocused] = useState(false);

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

  const handleIncrease = (e?: any) => {
    e?.stopPropagation?.();
    const current = parseInt(inputVal, 10);
    const nextVal = (isNaN(current) ? quantity : current) + 1;
    setInputVal(String(nextVal));
    updateQuantity(product.id, nextVal);
  };

  const handleDecrease = (e?: any) => {
    e?.stopPropagation?.();
    const current = parseInt(inputVal, 10);
    const nextVal = (isNaN(current) ? quantity : current) - 1;
    if (nextVal <= 0) {
      updateQuantity(product.id, 0);
    } else {
      setInputVal(String(nextVal));
      updateQuantity(product.id, nextVal);
    }
  };

  const handleIncreaseBuyQty = (e?: any) => {
    e?.stopPropagation?.();
    const current = parseInt(buyQty, 10);
    const nextVal = (isNaN(current) ? 1 : current) + 1;
    setBuyQty(String(nextVal));
  };

  const handleDecreaseBuyQty = (e?: any) => {
    e?.stopPropagation?.();
    const current = parseInt(buyQty, 10);
    const nextVal = Math.max(1, (isNaN(current) ? 1 : current) - 1);
    setBuyQty(String(nextVal));
  };

  const handleDirectBuy = (e?: any) => {
    e?.stopPropagation?.();
    const parsed = parseInt(buyQty, 10);
    const finalQty = !isNaN(parsed) && parsed > 0 ? parsed : 1;
    addProduct(product, finalQty);
    setBuyQty('1');
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
              price={displayPrice}
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

          {/* Footer: precio según rol (Lista 1 / 3 / 4) + controles de compra */}
          <View style={styles.footer}>
            <View style={styles.priceContainer}>
              <Text style={[styles.precio, (!displayPrice || displayPrice <= 0) && styles.sinPrecio]}>
                {displayPrice && displayPrice > 0 ? formatPrice(displayPrice) : 'Sin precio'}
              </Text>
              <Text style={styles.priceListTag}>{priceListTag}</Text>
            </View>

            {/* Botón "COMPRAR" con selector de cantidad previa (−/+/typear), o control si ya está en carrito */}
            {(!displayPrice || displayPrice <= 0) ? (
              <View style={styles.sinPrecioBtn}>
                <Text style={styles.sinPrecioBtnText}>No disponible</Text>
              </View>
            ) : quantity === 0 ? (
              <View
                style={styles.cardActionGroup}
                onStartShouldSetResponder={() => true}
                onTouchEnd={(e) => e?.stopPropagation?.()}
                {...(Platform.OS === 'web' ? { onClick: (e: any) => e?.stopPropagation?.() } : {})}
              >
                {/* Stepper previo con −, input para typear y + */}
                <View style={[styles.stepperRow, isInputFocused && styles.stepperRowFocused]}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={handleDecreaseBuyQty}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityLabel="Disminuir cantidad a comprar"
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>

                  <TextInput
                    style={styles.stepperInput}
                    value={buyQty}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/[^0-9]/g, '');
                      setBuyQty(cleaned);
                    }}
                    onFocus={() => setIsInputFocused(true)}
                    onBlur={() => {
                      setIsInputFocused(false);
                      const parsed = parseInt(buyQty, 10);
                      if (isNaN(parsed) || parsed <= 0) {
                        setBuyQty('1');
                      }
                    }}
                    onSubmitEditing={handleDirectBuy}
                    keyboardType="numeric"
                    selectTextOnFocus
                    returnKeyType="done"
                    maxLength={5}
                    placeholder="1"
                    placeholderTextColor="#94A3B8"
                    accessibilityLabel={`Cantidad para comprar de ${product.nombre}`}
                    {...(Platform.OS === 'web'
                      ? {
                          onKeyDown: (e: any) => {
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              const current = parseInt(buyQty, 10);
                              setBuyQty(String((isNaN(current) ? 1 : current) + 1));
                            } else if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              const current = parseInt(buyQty, 10);
                              setBuyQty(String(Math.max(1, (isNaN(current) ? 1 : current) - 1)));
                            }
                          },
                        }
                      : {})}
                  />

                  <TouchableOpacity
                    style={[styles.stepBtn, styles.stepBtnAdd]}
                    onPress={handleIncreaseBuyQty}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityLabel="Aumentar cantidad a comprar"
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.stepBtnText, styles.stepBtnAddText]}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Botón COMPRAR */}
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={handleDirectBuy}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={`Comprar ${buyQty || 1} de ${product.nombre}`}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="cart-outline" size={16} color={Colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.addButtonText}>COMPRAR</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={styles.cardActionGroup}
                onStartShouldSetResponder={() => true}
                onTouchEnd={(e) => e?.stopPropagation?.()}
                {...(Platform.OS === 'web' ? { onClick: (e: any) => e?.stopPropagation?.() } : {})}
              >
                {/* Stepper en carrito con −, input para editar y + */}
                <View style={styles.stepperRowInCart}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={handleDecrease}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityLabel="Quitar uno"
                    activeOpacity={0.7}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>

                  <TextInput
                    style={styles.stepperInputInCart}
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
                    {...(Platform.OS === 'web'
                      ? {
                          onKeyDown: (e: any) => {
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              handleIncrease();
                            } else if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              handleDecrease();
                            }
                          },
                        }
                      : {})}
                  />

                  <TouchableOpacity
                    style={[styles.stepBtn, styles.stepBtnInCartAdd]}
                    onPress={handleIncrease}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityLabel="Agregar uno más"
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.stepBtnText, styles.stepBtnAddText]}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Badge que indica que ya está en el carrito y permite ir */}
                <TouchableOpacity
                  style={styles.inCartBadgeBtn}
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    router.push('/(tabs)/carrito' as any);
                  }}
                  activeOpacity={0.8}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <MaterialCommunityIcons name="cart-check" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.inCartBadgeText}>En el carrito · Ver</Text>
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

  // Controles de compra y Stepper con + y -
  cardActionGroup: {
    width: '100%',
    gap: 6,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 32,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  stepperRowFocused: {
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.15)',
        } as any)
      : {
          elevation: 1,
        }),
  },
  stepperRowInCart: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 32,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  stepBtn: {
    width: 36,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 18,
  },
  stepBtnAdd: {
    backgroundColor: '#E2E8F0',
  },
  stepBtnInCartAdd: {
    backgroundColor: Colors.primary,
  },
  stepBtnAddText: {
    color: Colors.white,
  },
  stepperInput: {
    flex: 1,
    height: 32,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingVertical: 0,
    paddingHorizontal: 2,
    backgroundColor: 'transparent',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  stepperInputInCart: {
    flex: 1,
    height: 32,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    paddingVertical: 0,
    paddingHorizontal: 2,
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#DBEAFE',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    height: 34,
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
  inCartBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    width: '100%',
    borderRadius: Radius.md,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: Spacing.sm,
  },
  inCartBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.2,
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
