import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Animated,
  Image,
} from 'react-native';
import { Product } from '../types';
import { Colors } from '../constants/Colors';
import { FontSize, FontWeight } from '../constants/Typography';
import { Radius, Spacing } from '../constants/Spacing';
import { formatPrice } from '../utils/formatters';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { CATEGORY_ICONS } from '../types';
import MaterialCommunityIcons from './icons/MaterialCommunityIcons';
import { useEntrance } from '../hooks/useEntrance';

interface ProductCardProps {
  product: Product;
  style?: ViewStyle;
  onPress?: (product: Product) => void;
  delay?: number;
}

export function ProductCard({ product, style, onPress, delay = 0 }: ProductCardProps) {
  const { isLoggedIn } = useAuthStore();
  const { addProduct, getItemQuantity, updateQuantity } = useCartStore();
  const quantity = getItemQuantity(product.id);
  const icon = CATEGORY_ICONS[product.categoria];
  const isInCart = quantity > 0;
  const { animatedStyle } = useEntrance({ delay });

  return (
    <Animated.View style={[animatedStyle, styles.wrapper]}>
      <TouchableOpacity
        style={[styles.card, isInCart && styles.cardInCart, style]}
        onPress={() => onPress?.(product)}
        activeOpacity={0.88}
      >
        {/* Imagen/placeholder con gradiente suave */}
        <View style={[styles.imageContainer, isInCart && styles.imageContainerInCart]}>
          {product.imagen ? (
            <Image
              source={{ uri: product.imagen }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <MaterialCommunityIcons name={icon as any} size={44} color={Colors.primary} />
          )}
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
          <Text style={styles.codigo}>{product.codigo}</Text>
          <Text style={styles.nombre} numberOfLines={2}>
            {product.nombre}
          </Text>
          {product.presentacion && (
            <Text style={styles.presentacion} numberOfLines={1}>
              {product.presentacion}
            </Text>
          )}
          <Text style={styles.unidad}>por {product.unidad}</Text>

          {/* Footer: precio + controles */}
          <View style={styles.footer}>
            {isLoggedIn ? (
              <>
                <Text style={styles.precio}>{formatPrice(product.precio)}</Text>

                {/* Botón "+ Agregar" o control +/− */}
                {quantity === 0 ? (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => addProduct(product)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel={`Agregar ${product.nombre} al pedido`}
                    activeOpacity={0.78}
                  >
                    <Text style={styles.addButtonText}>+ Agregar</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.quantityControl}>
                    <TouchableOpacity
                      style={styles.qtyButton}
                      onPress={() => updateQuantity(product.id, quantity - 1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Quitar uno"
                    >
                      <Text style={styles.qtyButtonText}>−</Text>
                    </TouchableOpacity>

                    <Text style={styles.qtyText}>{quantity}</Text>

                    <TouchableOpacity
                      style={[styles.qtyButton, styles.qtyButtonAdd]}
                      onPress={() => addProduct(product)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Agregar uno más"
                    >
                      <Text style={[styles.qtyButtonText, styles.qtyButtonAddText]}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.publicPriceContainer}>
                <Text style={styles.publicPriceText}>Registrate para ver precios</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: 'hidden',
    flex: 1,
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  cardInCart: {
    borderColor: Colors.primary,
    shadowOpacity: 0.16,
    elevation: 5,
  },
  publicPriceContainer: {
    flex: 1,
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  publicPriceText: {
    fontSize: FontSize.sm - 2,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    textAlign: 'center',
  },
  imageContainer: {
    height: 135,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  imageContainerInCart: {
    backgroundColor: '#DBEAFE',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    // Gradiente inferior suave simulado con opacidad
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  cartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  cartBadgeText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.extrabold,
  },
  info: {
    padding: Spacing.md,
    flex: 1,
  },
  codigo: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    fontWeight: FontWeight.medium,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  nombre: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
    lineHeight: 21,
  },
  presentacion: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
    marginBottom: 2,
  },
  unidad: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    gap: 4,
    flexWrap: 'wrap',
  },
  precio: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },

  // Botón "Agregar"
  addButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },

  // Control +/−
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  qtyButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  qtyButtonAdd: {
    backgroundColor: Colors.primary,
  },
  qtyButtonText: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    lineHeight: 26,
  },
  qtyButtonAddText: {
    color: Colors.white,
  },
  qtyText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    minWidth: 28,
    textAlign: 'center',
  },
});
