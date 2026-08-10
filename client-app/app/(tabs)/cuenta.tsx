import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useAuthStore } from '../../store/authStore';

// Import modular screens
import { ClienteAccountScreen } from '../../components/screens/ClienteAccountScreen';
import { RepartidorHomeScreen } from '../../components/screens/RepartidorHomeScreen';
import MaterialCommunityIcons from '../../components/icons/MaterialCommunityIcons';
import { Platform, useWindowDimensions } from 'react-native';
import { DesktopStartScreen } from '../../components/screens/DesktopStartScreen';
import { MobileStartScreen } from '../../components/screens/MobileStartScreen';

export default function CuentaScreen() {
  const { isLoggedIn, userRole } = useAuthStore();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  if (!isLoggedIn) {
    return isDesktop ? <DesktopStartScreen /> : <MobileStartScreen />;
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
