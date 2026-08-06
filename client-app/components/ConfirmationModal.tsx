import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { useNotificationStore } from '../store/useNotificationStore';
import { Colors } from '../constants/Colors';
import { FontSize, FontWeight } from '../constants/Typography';
import { Radius, Spacing } from '../constants/Spacing';

export function ConfirmationModal() {
  const { modal, dismissConfirm } = useNotificationStore();

  useEffect(() => {
    if (!modal || Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        modal.onCancel?.();
        dismissConfirm();
      } else if (e.key === 'Enter') {
        modal.onConfirm();
        dismissConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modal]);

  if (!modal) return null;

  const handleCancel = () => {
    modal.onCancel?.();
    dismissConfirm();
  };

  const handleConfirm = () => {
    modal.onConfirm();
    dismissConfirm();
  };

  return (
    <Modal
      transparent
      visible={!!modal}
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{modal.title}</Text>
          <Text style={styles.message}>{modal.message}</Text>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel]}
              onPress={handleCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.btnCancelText}>
                {modal.cancelLabel || 'Cancelar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.btnConfirm]}
              onPress={handleConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.btnConfirmText}>
                {modal.confirmLabel || 'Confirmar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 440,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  btnCancel: {
    backgroundColor: '#f1f5f9',
  },
  btnCancelText: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
  btnConfirm: {
    backgroundColor: Colors.primary,
  },
  btnConfirmText: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
    fontSize: FontSize.md,
  },
});
