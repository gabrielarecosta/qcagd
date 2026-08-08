import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { useNotificationStore, ToastItem } from '../store/useNotificationStore';
import { Colors } from '../constants/Colors';
import { FontSize, FontWeight } from '../constants/Typography';
import { Radius, Spacing } from '../constants/Spacing';
import MaterialCommunityIcons from './icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');
const IS_MOBILE = width < 768;

function ToastCard({ item }: { item: ToastItem }) {
  const { dismissToast } = useNotificationStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -15,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      dismissToast(item.id);
    });
  };

  const getTheme = () => {
    switch (item.type) {
      case 'success':
        return {
          icon: 'check-circle' as const,
          color: '#10b981',
          bg: '#ecfdf5',
          border: '#a7f3d0',
        };
      case 'error':
        return {
          icon: 'alert-circle' as const,
          color: '#ef4444',
          bg: '#fef2f2',
          border: '#fca5a5',
        };
      case 'warning':
        return {
          icon: 'alert' as const,
          color: '#f59e0b',
          bg: '#fffbeb',
          border: '#fde68a',
        };
      case 'info':
      default:
        return {
          icon: 'information' as const,
          color: '#3b82f6',
          bg: '#eff6ff',
          border: '#bfdbfe',
        };
    }
  };

  const theme = getTheme();

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.toastCard, { backgroundColor: theme.bg, borderColor: theme.border }]}>
        <View style={styles.toastBody}>
          <MaterialCommunityIcons name={theme.icon} size={22} color={theme.color} style={styles.toastIcon} />
          <View style={styles.toastContent}>
            <Text style={styles.toastMessage}>{item.message}</Text>

            {/* Acciones */}
            {(item.actionLabel || item.secondaryActionLabel) && (
              <View style={styles.actionRow}>
                {item.secondaryActionLabel && (
                  <TouchableOpacity
                    style={styles.secondaryActionBtn}
                    onPress={() => {
                      item.onSecondaryAction?.();
                      handleDismiss();
                    }}
                  >
                    <Text style={[styles.secondaryActionText, { color: theme.color }]}>
                      {item.secondaryActionLabel}
                    </Text>
                  </TouchableOpacity>
                )}
                {item.actionLabel && (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: theme.color }]}
                    onPress={() => {
                      item.onAction?.();
                      handleDismiss();
                    }}
                  >
                    <Text style={styles.primaryActionText}>
                      {item.actionLabel}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity onPress={handleDismiss} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export function NotificationContainer() {
  const toasts = useNotificationStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container}>
      {toasts.map((toast) => (
        <ToastCard key={toast.id} item={toast} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 99999,
    pointerEvents: 'box-none', // Permite clics detrás en la pantalla si no toca el toast
  },
  toastWrapper: {
    width: IS_MOBILE ? '92%' : 420,
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  toastCard: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  toastBody: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'flex-start',
  },
  toastIcon: {
    marginRight: Spacing.md,
    marginTop: 2,
  },
  toastContent: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  toastMessage: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: '#1e293b',
    lineHeight: 20,
  },
  closeButton: {
    padding: 2,
    marginTop: -2,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  primaryActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  secondaryActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  secondaryActionText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
