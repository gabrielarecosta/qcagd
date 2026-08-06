import React from 'react';
import { Animated, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useEntrance } from '../../hooks/useEntrance';
import { Colors } from '../../constants/Colors';
import { Radius } from '../../constants/Spacing';

interface AnimatedCardProps {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}

/**
 * Wrapper con sombra premium y animación de entrada fade-in + slide-up.
 * Usar en lugar de View para cualquier card que necesite entrada animada.
 *
 * @example
 * <AnimatedCard delay={index * 80} elevated>
 *   <Text>Contenido</Text>
 * </AnimatedCard>
 */
export function AnimatedCard({ children, delay = 0, style, elevated = false }: AnimatedCardProps) {
  const { animatedStyle } = useEntrance({ delay });

  return (
    <Animated.View style={[styles.card, elevated && styles.elevated, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 6,
  },
});
