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

interface RegisterClienteScreenProps {
  onBack: () => void;
}

function AnimatedInput({
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default' as any,
  autoCapitalize = 'words' as any,
  delay = 0,
}: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  keyboardType?: any;
  autoCapitalize?: any;
  delay?: number;
}) {
  const borderColor = useRef(new Animated.Value(0)).current;
  const { animatedStyle } = useEntrance({ delay, fromY: 10 });

  const animatedBorder = borderColor.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, Colors.primary],
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
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          onFocus={() =>
            Animated.timing(borderColor, { toValue: 1, duration: 200, useNativeDriver: false }).start()
          }
          onBlur={() =>
            Animated.timing(borderColor, { toValue: 0, duration: 200, useNativeDriver: false }).start()
          }
        />
      </Animated.View>
    </Animated.View>
  );
}

export function RegisterClienteScreen({ onBack }: RegisterClienteScreenProps) {
  const { loginAsCliente } = useAuthStore();
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regCuit, setRegCuit] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logoAnim = useEntrance({ delay: 0, duration: 500 });
  const titleAnim = useEntrance({ delay: 80, duration: 400 });
  const buttonAnim = useEntrance({ delay: 380, duration: 400 });

  const handleRegister = async () => {
    setError(null);
    if (!regName.trim() || !regPhone.trim() || !regAddress.trim()) {
      setError('Por favor completá los campos obligatorios: Nombre, Teléfono y Dirección.');
      return;
    }

    if (!acceptedTerms) {
      setError('Debés aceptar los términos y condiciones para registrarte.');
      return;
    }

    const success = await loginAsCliente(regName);
    if (success) {
      setRegName('');
      setRegPhone('');
      setRegAddress('');
      setRegCuit('');
      setAcceptedTerms(false);
      customAlert(
        'Registro Exitoso',
        '¡Tu cuenta ha sido creada con éxito! Ya ingresaste al sistema.'
      );
    } else {
      setError('No pudimos registrar tu cuenta en este momento.');
    }
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.centerContent} keyboardShouldPersistTaps="handled">

        <Animated.View style={[styles.logoWrapper, logoAnim.animatedStyle]}>
          <View style={styles.logoBg}>
            <MaterialCommunityIcons name="account-plus" size={40} color={Colors.primary} />
          </View>
        </Animated.View>

        <Animated.View style={titleAnim.animatedStyle}>
          <Text style={styles.loginTitle}>Registrarme</Text>
          <Text style={styles.loginSub}>
            Ingresá tus datos para empezar a comprar en Química Deheza.
          </Text>
        </Animated.View>

        <AnimatedInput
          placeholder="Nombre Completo o Comercio *"
          value={regName}
          onChangeText={setRegName}
          autoCapitalize="words"
          delay={160}
        />

        <AnimatedInput
          placeholder="Teléfono Celular *"
          value={regPhone}
          onChangeText={setRegPhone}
          keyboardType="phone-pad"
          autoCapitalize="none"
          delay={220}
        />

        <AnimatedInput
          placeholder="Dirección de Entrega *"
          value={regAddress}
          onChangeText={setRegAddress}
          delay={280}
        />

        <AnimatedInput
          placeholder="CUIT o DNI (Opcional)"
          value={regCuit}
          onChangeText={setRegCuit}
          keyboardType="numeric"
          autoCapitalize="none"
          delay={340}
        />

        {/* Checkbox Términos y Condiciones */}
        <View style={styles.termsRow}>
          <TouchableOpacity
            style={[styles.checkbox, acceptedTerms && styles.checkboxActive]}
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            activeOpacity={0.8}
          >
            {acceptedTerms && <MaterialCommunityIcons name="check" size={16} color={Colors.white} />}
          </TouchableOpacity>
          <Text style={styles.termsText}>
            Acepto los{' '}
            <Text
              style={styles.termsLink}
              onPress={() => {
                customAlert(
                  'Términos y Condiciones',
                  'Bienvenido a Química Deheza.\n\n1. El uso de esta aplicación implica la aceptación de todos nuestros términos de servicio.\n2. Los precios provistos en el catálogo son orientativos y pueden variar al momento de facturación definitiva.\n3. Los repartos están sujetos a disponibilidad de stock y capacidad de franjas horarias.\n4. La entrega se realiza bajo los métodos de pago coordinados.'
                );
              }}
            >
              términos y condiciones
            </Text>
          </Text>
        </View>

        {error && (
          <Text style={{ color: '#ef4444', fontSize: 13, marginBottom: Spacing.md, textAlign: 'center', fontWeight: '500' }}>
            {error}
          </Text>
        )}

        <Animated.View style={[{ width: '100%', gap: Spacing.md }, buttonAnim.animatedStyle]}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} activeOpacity={0.82}>
            <Text style={styles.primaryButtonText}>Registrarme e Ingresar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={onBack} activeOpacity={0.8}>
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
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  termsText: {
    fontSize: 15,
    color: Colors.textSecondary,
    flex: 1,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    textDecorationLine: 'underline',
  },
});
