import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { useAuthStore } from '../../store/authStore';
import { customAlert } from '../../utils/alert';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEntrance } from '../../hooks/useEntrance';

interface LoginRepartidorScreenProps {
  onBack: () => void;
}

function AnimatedInput({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  delay = 0,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  delay?: number;
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = useRef(new Animated.Value(0)).current;
  const { animatedStyle } = useEntrance({ delay, fromY: 10 });

  const handleFocus = () => {
    setFocused(true);
    Animated.timing(borderColor, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };
  const handleBlur = () => {
    setFocused(false);
    Animated.timing(borderColor, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const animatedBorder = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, Colors.success],
  });

  return (
    <Animated.View style={[animatedStyle, { width: '100%', marginBottom: Spacing.lg }]}>
      <Animated.View style={[styles.inputContainer, { borderColor: animatedBorder }]}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Animated.View>
    </Animated.View>
  );
}

export function LoginRepartidorScreen({ onBack }: LoginRepartidorScreenProps) {
  const { loginAsRepartidor, lastUsername, sessionExpired, setSessionExpired } = useAuthStore();
  const [driverInput, setDriverInput] = useState(lastUsername || '');
  const [driverPassword, setDriverPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const logoAnim = useEntrance({ delay: 0, duration: 500 });
  const titleAnim = useEntrance({ delay: 80, duration: 400 });
  const buttonAnim = useEntrance({ delay: 320, duration: 400 });

  const handleDriverLogin = async () => {
    setError(null);
    if (!driverInput.trim()) {
      setError('Por favor, escribí tu usuario, teléfono o código de repartidor.');
      return;
    }
    const success = await loginAsRepartidor(driverInput, driverPassword);
    if (success) {
      setDriverPassword('');
    } else {
      setError('No pudimos encontrar tus datos de repartidor.');
    }
  };

  const handleBack = () => {
    setSessionExpired(false);
    onBack();
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.centerContent} keyboardShouldPersistTaps="handled">

        {/* Logo animado — verde para diferenciar repartidor */}
        <Animated.View style={[styles.logoWrapper, logoAnim.animatedStyle]}>
          <View style={styles.logoBg}>
            <MaterialCommunityIcons name="truck-delivery" size={40} color={Colors.success} />
          </View>
        </Animated.View>

        <Animated.View style={titleAnim.animatedStyle}>
          <Text style={styles.loginTitle}>Ingreso repartidor</Text>
          <Text style={styles.loginSub}>
            Acceso exclusivo para el personal de logística y choferes de Química Deheza.
          </Text>
        </Animated.View>

        {sessionExpired && (
          <View style={styles.expiredBanner}>
            <MaterialCommunityIcons name="alert-circle" size={18} color="#b45309" style={{ marginRight: 8 }} />
            <Text style={styles.expiredText}>
              Tu sesión expiró por inactividad. Por favor, ingresá nuevamente.
            </Text>
          </View>
        )}

        <AnimatedInput
          placeholder="Usuario / teléfono / código"
          value={driverInput}
          onChangeText={setDriverInput}
          delay={160}
        />

        <AnimatedInput
          placeholder="Contraseña o código"
          value={driverPassword}
          onChangeText={setDriverPassword}
          secureTextEntry
          delay={240}
        />

        {error && (
          <Text style={{ color: '#ef4444', fontSize: 13, marginBottom: Spacing.md, textAlign: 'center', fontWeight: '500' }}>
            {error}
          </Text>
        )}

        <Animated.View style={[{ width: '100%', gap: Spacing.md }, buttonAnim.animatedStyle]}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleDriverLogin}
            activeOpacity={0.82}
          >
            <Text style={styles.primaryButtonText}>Ingresar como repartidor</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={handleBack} activeOpacity={0.8}>
            <Text style={styles.linkButtonText}>← Volver a mi cuenta</Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  centerContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    backgroundColor: Colors.white,
  },
  logoWrapper: {
    marginBottom: Spacing.xl,
  },
  logoBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  loginSub: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },
  inputContainer: {
    width: '100%',
    height: 60,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 2,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  input: {
    fontSize: 18,
    color: Colors.textPrimary,
    height: '100%',
  },
  primaryButton: {
    width: '100%',
    height: 60,
    borderRadius: Radius.lg,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: FontWeight.bold,
  },
  linkButton: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  linkButtonText: {
    color: Colors.primary,
    fontSize: 18,
    fontWeight: FontWeight.semibold,
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  expiredText: {
    flex: 1,
    color: '#b45309',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
