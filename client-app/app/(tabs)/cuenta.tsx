import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';

// Import modular screens
import { ClienteAccountScreen } from '../../components/screens/ClienteAccountScreen';
import { RepartidorHomeScreen } from '../../components/screens/RepartidorHomeScreen';
import { GuestAccountScreen } from '../../components/screens/GuestAccountScreen';

export default function CuentaScreen() {
  const { isLoggedIn, userRole } = useAuthStore();

  if (!isLoggedIn) {
    return <GuestAccountScreen />;
  }

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
