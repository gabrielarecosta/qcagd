import React, { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Animated,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { FontSize } from '../../constants/Typography';
import { Radius, Spacing, TouchTarget } from '../../constants/Spacing';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear?: () => void;
  placeholder?: string;
  style?: ViewStyle;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  onClear,
  placeholder = 'Buscar producto...',
  style,
  autoFocus = false,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
  };

  const handleBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  const handleClear = () => {
    onChangeText('');
    onClear?.();
  };

  const animatedBorderColor = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, Colors.primary],
  });

  const animatedShadowOpacity = borderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.04, 0.12],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          borderColor: animatedBorderColor,
          shadowOpacity: animatedShadowOpacity,
        },
      ]}
    >
      {/* Ícono lupa */}
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name="magnify"
          size={22}
          color={focused ? Colors.primary : Colors.textDisabled}
        />
      </View>

      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textDisabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        blurOnSubmit={false}
        clearButtonMode="never"
        onSubmitEditing={(e) => {
          // Prevenir recarga involuntaria de página o envío de formularios
          e?.preventDefault?.();
        }}
      />

      {/* Botón limpiar accesible */}
      {value.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Limpiar búsqueda"
          testID="clear-search-button"
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="close-circle" size={20} color={Colors.textDisabled} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    height: TouchTarget.large,
    elevation: 0,
    shadowOpacity: 0,
  },
  iconContainer: {
    marginRight: Spacing.sm,
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    padding: 0,
  },
  clearButton: {
    marginLeft: Spacing.sm,
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
