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
import MaterialCommunityIcons from '@/components/icons/MaterialCommunityIcons';
import { useEntrance } from '../../hooks/useEntrance';

interface LoginClienteScreenProps {
  onBack: () => void;
}

function AnimatedInput({
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default' as any,
  autoCapitalize = 'none' as any,
  delay = 0,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
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
    outputRange: [Colors.border, Colors.primary],
  });

  return (
    <Animated.View style={[animatedStyle, { width: '100%', marginBottom: Spacing.lg }]}>
      <Animated.View
        style={[
          styles.inputContainer,
          { borderColor: animatedBorder },
        ]}
      >
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Animated.View>
    </Animated.View>
  );
}

export function LoginClienteScreen({ onBack }: LoginClienteScreenProps) {
  const { loginAsCliente, lastUsername, sessionExpired, setSessionExpired } = useAuthStore();
  const [loginInput, setLoginInput] = useState(lastUsername || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const logoAnim = useEntrance({ delay: 0, duration: 500 });
  const titleAnim = useEntrance({ delay: 80, duration: 400 });
  const buttonAnim = useEntrance({ delay: 320, duration: 400 });

  const handleClientLogin = async () => {
    setError(null);
    if (!loginInput.trim()) {
      setError('Por favor, escribí tu usuario, teléfono, CUIT o Email.');
      return;
    }
    const success = await loginAsCliente(loginInput, loginPassword);
    if (success) {
      setLoginPassword('');
    } else {
      setError('No pudimos encontrar tus datos. Por favor, verifique e intente nuevamente.');
    }
  };

  const handleBack = () => {
    setSessionExpired(false);
    onBack();
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.centerContent} keyboardShouldPersistTaps="handled">

        {/* Logo animado */}
        <Animated.View style={[styles.logoWrapper, logoAnim.animatedStyle]}>
          <View style={styles.logoBg}>
            <MaterialCommunityIcons name="flask" size={40} color={Colors.primary} />
          </View>
        </Animated.View>

        <Animated.View style={titleAnim.animatedStyle}>
          <Text style={styles.loginTitle}>Ingreso Cliente</Text>
          <Text style={styles.loginSub}>
            Ingresá tu usuario o datos de cuenta para acceder a tus pedidos y tracking.
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
          placeholder="Usuario, Teléfono o CUIT (Ej: ana)"
          value={loginInput}
          onChangeText={setLoginInput}
          delay={160}
        />

        <AnimatedInput
          placeholder="Contraseña (Ej: ana)"
          value={loginPassword}
          onChangeText={setLoginPassword}
          secureTextEntry
          delay={230}
        />



        {error && (
          <Text style={{ color: '#ef4444', fontSize: 13, marginBottom: Spacing.md, textAlign: 'center', fontWeight: '500' }}>
            {error}
          </Text>
        )}

        <Animated.View style={[{ width: '100%', gap: Spacing.md }, buttonAnim.animatedStyle]}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleClientLogin} activeOpacity={0.82}>
            <Text style={styles.primaryButtonText}>Ingresar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleBack} activeOpacity={0.8}>
            <Text style={styles.secondaryButtonText}>Volver</Text>
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
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
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
  demoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
    width: '100%',
  },
  demoText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    flex: 1,
    lineHeight: 20,
  },
  primaryButton: {
    width: '100%',
    height: 60,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
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
  secondaryButton: {
    width: '100%',
    height: 60,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: FontWeight.bold,
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
