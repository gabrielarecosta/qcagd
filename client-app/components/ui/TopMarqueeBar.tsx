import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';

const TICKER_ITEMS = [
  { icon: 'cart-outline', text: 'Mínimo de compra online $30.000.' },
  { icon: 'storefront-outline', text: 'Productos disponibles para Minorista y Mayorista.' },
  { icon: 'whatsapp', text: 'Atención personalizada para consultas por volumen.' },
  { icon: 'truck-fast-outline', text: 'Repartos domicilio en Gral. Deheza y zona en 24 horas.' },
];

export function TopMarqueeBar() {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Si no es web, usamos el loop nativo de Animated
    if (Platform.OS !== 'web') {
      const loopAnim = Animated.loop(
        Animated.timing(animatedValue, {
          toValue: -800,
          duration: 25000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loopAnim.start();
      return () => loopAnim.stop();
    }
  }, []);

  const renderContent = (keyPrefix: string) => (
    <View style={styles.tickerGroup} key={keyPrefix}>
      {TICKER_ITEMS.map((item, idx) => (
        <View key={`${keyPrefix}-${idx}`} style={styles.tickerItem}>
          <MaterialCommunityIcons
            name={item.icon as any}
            size={13}
            color="#60A5FA"
            style={styles.itemIcon}
          />
          <Text style={styles.tickerText}>{item.text}</Text>
          <Text style={styles.dotSeparator}>•</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.barContainer}>
      {Platform.OS === 'web' ? (
        <div
          style={{
            display: 'flex',
            width: 'max-content',
            animation: 'marqueeContinuous 30s linear infinite',
          }}
          className="qgd-marquee-track"
        >
          {renderContent('set-1')}
          {renderContent('set-2')}
          {renderContent('set-3')}
        </div>
      ) : (
        <Animated.View
          style={[
            styles.animatedTrack,
            {
              transform: [{ translateX: animatedValue }],
            },
          ]}
        >
          {renderContent('native-1')}
          {renderContent('native-2')}
        </Animated.View>
      )}

      {/* Inyección de CSS Keyframe en la web para animación fluida a 60fps */}
      {Platform.OS === 'web' && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @keyframes marqueeContinuous {
              0% { transform: translateX(0%); }
              100% { transform: translateX(-33.333333%); }
            }
            .qgd-marquee-track:hover {
              animation-play-state: paused;
            }
          `,
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    backgroundColor: '#0A192F', // Azul oscuro profundo y elegante
    height: 34,
    overflow: 'hidden',
    justifyContent: 'center',
    width: '100%',
    zIndex: 10000,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  animatedTrack: {
    flexDirection: 'row',
    width: 2400,
  },
  tickerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  tickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  itemIcon: {
    marginRight: 6,
  },
  tickerText: {
    color: '#F8FAFC',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dotSeparator: {
    color: '#60A5FA',
    fontSize: 14,
    marginLeft: 14,
    opacity: 0.8,
  },
});
