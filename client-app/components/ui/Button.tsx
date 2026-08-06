import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, TouchTarget } from '../../constants/Spacing';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}

export function Button({
  title,
  variant = 'primary',
  size = 'lg',
  loading = false,
  icon,
  fullWidth = true,
  style,
  textStyle,
  disabled,
  onPress,
  onLongPress,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (isDisabled) return;
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.base,
        styles[variant],
        styles[`size_${size}` as keyof typeof styles] as any,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        // Sombra solo en variantes sólidas
        (variant === 'primary' || variant === 'success' || variant === 'danger') && styles.solidShadow,
        style,
        { transform: [{ scale }] },
      ]}
    >
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        onLongPress={isDisabled ? undefined : onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityLabel={accessibilityLabel}
        style={styles.pressable}
      >
        {loading ? (
          <ActivityIndicator
            color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.white}
            size="small"
          />
        ) : (
          <>
            {icon && icon}
            <Text
              style={[
                styles.text,
                styles[`text_${variant}` as keyof typeof styles] as any,
                styles[`textSize_${size}` as keyof typeof styles] as any,
                textStyle,
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  pressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.48,
  },
  solidShadow: {
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },

  // Variantes
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.surfaceAlt,
  },
  success: {
    backgroundColor: Colors.success,
  },
  danger: {
    backgroundColor: Colors.danger,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },

  // Tamaños
  size_sm: {
    height: TouchTarget.small,
    paddingHorizontal: 14,
  },
  size_md: {
    height: TouchTarget.medium,
    paddingHorizontal: 20,
  },
  size_lg: {
    height: TouchTarget.large,
    paddingHorizontal: 24,
  },

  // Texto base
  text: {
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },

  // Color del texto por variante
  text_primary: { color: Colors.white },
  text_secondary: { color: Colors.textPrimary },
  text_success: { color: Colors.white },
  text_danger: { color: Colors.white },
  text_outline: { color: Colors.primary },
  text_ghost: { color: Colors.primary },

  // Tamaño del texto
  textSize_sm: { fontSize: FontSize.md },
  textSize_md: { fontSize: FontSize.lg },
  textSize_lg: { fontSize: FontSize.xl },
});
