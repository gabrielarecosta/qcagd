import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Radius } from '../../constants/Spacing';

type SkeletonVariant = 'product' | 'order' | 'row' | 'header';

interface SkeletonCardProps {
  variant?: SkeletonVariant;
  style?: StyleProp<ViewStyle>;
}

/**
 * Skeleton loader animado (efecto pulse) para usar mientras cargan datos.
 * Usa Animated API nativa — sin librerías externas.
 */
export function SkeletonCard({ variant = 'product', style }: SkeletonCardProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  if (variant === 'product') {
    return (
      <Animated.View style={[styles.productCard, style, { opacity }]}>
        <View style={styles.productImage} />
        <View style={styles.productBody}>
          <View style={[styles.line, { width: '40%', height: 10 }]} />
          <View style={[styles.line, { width: '80%', height: 14, marginTop: 6 }]} />
          <View style={[styles.line, { width: '60%', height: 12, marginTop: 4 }]} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
            <View style={[styles.line, { width: '35%', height: 16 }]} />
            <View style={[styles.button]} />
          </View>
        </View>
      </Animated.View>
    );
  }

  if (variant === 'order') {
    return (
      <Animated.View style={[styles.orderCard, style, { opacity }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={[styles.line, { width: '30%', height: 16 }]} />
          <View style={[styles.badge]} />
        </View>
        <View style={[styles.line, { width: '55%', height: 12, marginTop: 8 }]} />
        <View style={[styles.line, { width: '45%', height: 12, marginTop: 6 }]} />
        <View style={[styles.divider]} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={[styles.line, { width: '25%', height: 18 }]} />
          <View style={[styles.button]} />
        </View>
      </Animated.View>
    );
  }

  if (variant === 'row') {
    return (
      <Animated.View style={[styles.rowCard, style, { opacity }]}>
        <View style={styles.rowIcon} />
        <View style={{ flex: 1, gap: 6 }}>
          <View style={[styles.line, { width: '60%', height: 14 }]} />
          <View style={[styles.line, { width: '40%', height: 12 }]} />
        </View>
      </Animated.View>
    );
  }

  // header
  return (
    <Animated.View style={[styles.header, style, { opacity }]}>
      <View style={{ gap: 8, flex: 1 }}>
        <View style={[styles.line, { width: '50%', height: 20 }]} />
        <View style={[styles.line, { width: '35%', height: 14 }]} />
      </View>
      <View style={styles.avatar} />
    </Animated.View>
  );
}

const skeletonColor = '#E2E8F0';
const skeletonDark = '#CBD5E1';

const styles = StyleSheet.create({
  // Product skeleton
  productCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    flex: 1,
  },
  productImage: {
    height: 90,
    backgroundColor: skeletonColor,
  },
  productBody: {
    padding: 12,
  },

  // Order skeleton
  orderCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  badge: {
    width: 80,
    height: 24,
    borderRadius: 12,
    backgroundColor: skeletonColor,
  },
  divider: {
    height: 1,
    backgroundColor: skeletonColor,
    marginVertical: 12,
  },
  button: {
    width: 70,
    height: 32,
    borderRadius: 8,
    backgroundColor: skeletonColor,
  },

  // Row skeleton
  rowCard: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: skeletonColor,
  },

  // Header skeleton
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: skeletonColor,
  },

  // Shared
  line: {
    backgroundColor: skeletonColor,
    borderRadius: 4,
  },
});
