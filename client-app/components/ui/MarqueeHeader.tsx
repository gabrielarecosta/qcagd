import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';

const BANNER_TEXT = "ENVIOS GRATIS 🚚           -           BUSCAS ALGO RÁPIDO? MIRÁ NUESTRO CATALOGO SIN REGISTRARTE! ✅        -        PAGÁ COMO QUIERAS 💵";

export function MarqueeHeader() {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    animatedValue.setValue(0);
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: -1,
        duration: 16000,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [-1, 0],
    outputRange: [-800, 0],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.track, { transform: [{ translateX }] }]}>
        <Text style={styles.text}>
          {BANNER_TEXT}              -              {BANNER_TEXT}              -              {BANNER_TEXT}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 38,
    backgroundColor: '#1e40af', // Azul brillante corporativo a tono con el diseño
    overflow: 'hidden',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3b82f6',
    zIndex: 9999,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 4000,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
