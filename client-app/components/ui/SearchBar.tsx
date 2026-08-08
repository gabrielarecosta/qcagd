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
import MaterialCommunityIcons from '@/components/icons/MaterialCommunityIcons';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Buscar producto...',
  style,
  autoFocus = false,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);
  const borderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(borderAnim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };

  const handleBlur = () => {
    setFocused(false);
    Animated.timing(borderAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
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
        clearButtonMode="while-editing"
      />

      {/* Botón limpiar (Android / fallback) */}
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          style={styles.clearButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    height: TouchTarget.large,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
