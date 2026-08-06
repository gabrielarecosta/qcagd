import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

interface UseEntranceOptions {
  delay?: number;
  duration?: number;
  fromY?: number;
}

/**
 * Hook reutilizable para animaciones de entrada fade-in + slide-up.
 * Usa únicamente la Animated API nativa de React Native (sin dependencias externas).
 *
 * @param delay   - Retardo antes de iniciar la animación (ms). Útil para escalonado en listas.
 * @param duration - Duración total de la animación (ms). Default: 400ms.
 * @param fromY   - Desplazamiento vertical de inicio (px). Default: 18px.
 *
 * @example
 * const { animatedStyle } = useEntrance({ delay: index * 80 });
 * return <Animated.View style={[styles.card, animatedStyle]}>...</Animated.View>
 */
export function useEntrance({ delay = 0, duration = 400, fromY = 18 }: UseEntranceOptions = {}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay,
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, []);

  const animatedStyle = {
    opacity,
    transform: [{ translateY }],
  };

  return { opacity, translateY, animatedStyle };
}
