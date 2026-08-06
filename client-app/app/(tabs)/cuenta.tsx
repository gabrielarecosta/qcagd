import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';

// Import modular screens
import { ClienteAccountScreen } from '../../components/screens/ClienteAccountScreen';
import { RepartidorHomeScreen } from '../../components/screens/RepartidorHomeScreen';

export default function CuentaScreen() {
  const { userRole } = useAuthStore();

  return (
    <SafeAreaView style={styles.safeArea}>
      {userRole === 'repartidor' ? (
        <RepartidorHomeScreen />
      ) : (
        <ClienteAccountScreen />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
