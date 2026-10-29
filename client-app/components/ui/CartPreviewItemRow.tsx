import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { FontWeight } from '../../constants/Typography';
import { Radius } from '../../constants/Spacing';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';
import { CartItem, CATEGORY_ICONS } from '../../types';
import { formatPrice } from '../../utils/formatters';

interface CartPreviewItemRowProps {
  item: CartItem;
  onUpdateQty: (qty: number) => void;
  onRemove: () => void;
  onOpenProduct: () => void;
}

export function CartPreviewItemRow({
  item,
  onUpdateQty,
  onRemove,
  onOpenProduct,
}: CartPreviewItemRowProps) {
  const [val, setVal] = useState(String(item.cantidad));

  useEffect(() => {
    setVal(String(item.cantidad));
  }, [item.cantidad]);

  const commit = () => {
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      onUpdateQty(num);
    } else if (num === 0) {
      onRemove();
    } else {
      setVal(String(item.cantidad));
    }
  };

  const iconName = (CATEGORY_ICONS as any)?.[item.producto.categoria] || 'package-variant';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.imgWrap}
        onPress={onOpenProduct}
        activeOpacity={0.8}
      >
        {item.producto.imagen ? (
          <Image
            source={{ uri: item.producto.imagen }}
            style={styles.img}
            resizeMode="contain"
          />
        ) : (
          <MaterialCommunityIcons
            name={iconName as any}
            size={20}
            color={Colors.primary}
          />
        )}
      </TouchableOpacity>

      <View style={styles.infoCol}>
        <TouchableOpacity onPress={onOpenProduct} activeOpacity={0.8}>
          <Text 
            style={styles.name} 
            numberOfLines={1}
            {...(Platform.OS === 'web' ? ({ translate: 'no', className: 'notranslate' } as any) : {})}
          >
            {Platform.OS === 'web' ? (
              <span className="notranslate" translate="no">
                {item.producto.nombre}
              </span>
            ) : (
              item.producto.nombre
            )}
          </Text>
        </TouchableOpacity>
        <Text style={styles.price}>
          {formatPrice(item.producto.precio)}
        </Text>
      </View>

      <View style={styles.stepperContainer}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => {
            if (item.cantidad > 1) {
              onUpdateQty(item.cantidad - 1);
            } else {
              onRemove();
            }
          }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={item.cantidad === 1 ? 'trash-can-outline' : 'minus'}
            size={13}
            color={item.cantidad === 1 ? '#EF4444' : Colors.textPrimary}
          />
        </TouchableOpacity>

        <TextInput
          style={styles.stepInput}
          keyboardType="numeric"
          value={val}
          onChangeText={(t) => setVal(t.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onSubmitEditing={commit}
          selectTextOnFocus
          maxLength={4}
        />

        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => onUpdateQty(item.cantidad + 1)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="plus" size={13} color={Colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onRemove}
          activeOpacity={0.7}
          accessibilityLabel="Eliminar producto"
        >
          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
    gap: 8,
  },
  imgWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  img: {
    width: 42,
    height: 42,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  name: {
    fontSize: 12.5,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  price: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 2,
    flexShrink: 0,
  },
  stepBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  stepInput: {
    width: 34,
    height: 24,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    paddingHorizontal: 2,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  deleteBtn: {
    marginLeft: 4,
    padding: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
});
