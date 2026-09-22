import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { MisListasScreen } from '../../components/screens/MisListasScreen';
import { Colors } from '../../constants/Colors';

export default function ListasTab() {
  return (
    <SafeAreaView style={styles.container}>
      <MisListasScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
