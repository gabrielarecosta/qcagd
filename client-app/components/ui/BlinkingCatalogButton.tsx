import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';

interface BlinkingCatalogButtonProps {
  onPress: () => void;
  style?: ViewStyle;
}

export function BlinkingCatalogButton({ onPress, style }: BlinkingCatalogButtonProps) {
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const blinkLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 0.45,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.98,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.02,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    blinkLoop.start();
    return () => blinkLoop.stop();
  }, [opacityAnim, scaleAnim]);

  return (
    <Animated.View style={[{ width: '100%', opacity: opacityAnim, transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="shopping-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.buttonText}>VER CATÁLOGO</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    backgroundColor: '#0284c7', // Azul cyan/sky brillante muy vistoso
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 2,
    borderColor: '#38bdf8',
    marginTop: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
});
