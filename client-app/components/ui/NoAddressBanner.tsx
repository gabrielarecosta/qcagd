import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { clientService } from '@shared/services/clientService';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';

export function NoAddressBanner() {
  const router = useRouter();
  const { isLoggedIn, userRole, clientData } = useAuthStore();
  const [hasAddress, setHasAddress] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const checkAddress = async () => {
      if (!isLoggedIn || userRole !== 'cliente' || !clientData?.id) {
        if (isMounted) setHasAddress(true);
        return;
      }

      // 1. Revisar si la dirección principal del perfil está presente
      const mainDir = (clientData.direccion || '').trim();
      const isMainDirValid = mainDir !== '' && mainDir !== 'Sin dirección registrada' && mainDir !== 'Sin dirección';

      if (isMainDirValid) {
        if (isMounted) setHasAddress(true);
        return;
      }

      // 2. Revisar si tiene direcciones secundarias cargadas en la tabla customer_addresses
      try {
        const addresses = await clientService.getAddresses(clientData.id);
        if (isMounted) {
          setHasAddress(addresses && addresses.length > 0);
        }
      } catch (_) {
        if (isMounted) setHasAddress(false);
      }
    };

    checkAddress();

    return () => {
      isMounted = false;
    };
  }, [isLoggedIn, userRole, clientData]);

  if (hasAddress || !isLoggedIn || userRole !== 'cliente') {
    return null;
  }

  return (
    <View style={styles.bannerContainer}>
      <View style={styles.contentRow}>
        <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#ffffff" style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={styles.bannerTitle}>Sin dirección de envío</Text>
          <Text style={styles.bannerDesc}>
            Agregá una dirección en tu Cuenta para poder realizar pedidos a domicilio.
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={() => router.push('/(tabs)/cuenta')}
        activeOpacity={0.85}
      >
        <Text style={styles.actionBtnText}>+ Cargar Dirección</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#dc2626', // Rojo alerta intenso
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#b91c1c',
    zIndex: 9999,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  icon: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  bannerTitle: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  bannerDesc: {
    color: '#fef2f2',
    fontSize: 11,
    marginTop: 1,
  },
  actionBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  actionBtnText: {
    color: '#dc2626',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
