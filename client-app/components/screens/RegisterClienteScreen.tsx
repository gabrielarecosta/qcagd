import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { useAuthStore } from '../../store/authStore';
import { customAlert } from '../../utils/alert';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';
import { useEntrance } from '../../hooks/useEntrance';
import { clientService } from '@shared/services/clientService';
import { geocodeAddress } from '@shared/utils/geo';
import { branchService } from '@shared/services/branchService';
import { Branch } from '@shared/types/branch';

interface RegisterClienteScreenProps {
  onBack: () => void;
}

type AccountType = 'consumidor_final' | 'sucursal';

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
    <Animated.View style={[animatedStyle, { width: '100%', marginBottom: Spacing.md }]}>
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
  const { setClienteSession } = useAuthStore();
  const [accountType, setAccountType] = useState<AccountType>('consumidor_final');

  // Campos Comunes / Consumidor Final
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCuit, setRegCuit] = useState('');

  // Campos Sucursal
  const [branchName, setBranchName] = useState('');
  const [branchContact, setBranchContact] = useState('');
  const [branchCuit, setBranchCuit] = useState('');
  const [branchPhone, setBranchPhone] = useState('');
  const [branchEmail, setBranchEmail] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('branch-gd1');
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logoAnim = useEntrance({ delay: 0, duration: 500 });
  const titleAnim = useEntrance({ delay: 80, duration: 400 });
  const buttonAnim = useEntrance({ delay: 380, duration: 400 });

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const list = await branchService.getAll();
        if (list && list.length > 0) {
          setAvailableBranches(list);
          setSelectedBranchId(list[0].id);
        }
      } catch (err) {
        console.warn('Error cargando sucursales para registro:', err);
      }
    };
    loadBranches();
  }, []);

  const handleRegister = async () => {
    setError(null);

    if (accountType === 'consumidor_final') {
      if (!regName.trim() || !regPhone.trim()) {
        setError('Por favor completá los campos obligatorios: Nombre y Teléfono.');
        return;
      }
    } else {
      if (!branchName.trim() || !branchContact.trim() || !branchPhone.trim()) {
        setError('Por favor completá los campos obligatorios: Nombre de Sucursal, Contacto responsable y Teléfono.');
        return;
      }
    }

    if (!acceptedTerms) {
      setError('Debés aceptar los términos y condiciones para registrarte.');
      return;
    }

    setIsLoading(true);

    try {
      const isSucursal = accountType === 'sucursal';
      const nombreFinal = isSucursal ? branchName.trim() : regName.trim();
      const contactoFinal = isSucursal ? branchContact.trim() : regName.trim();
      const telefonoFinal = isSucursal ? branchPhone.trim() : regPhone.trim();
      const emailFinal = isSucursal ? branchEmail.trim() : regEmail.trim();
      const cuitFinal = isSucursal ? branchCuit.trim() : regCuit.trim();
      const branchAsignada = isSucursal ? selectedBranchId : 'branch-gd1';

      // 1. Crear el cliente en Supabase sin dirección inicial
      const newCustomer = await clientService.create({
        nombre: nombreFinal,
        razonSocial: isSucursal ? nombreFinal : undefined,
        cuit: cuitFinal || undefined,
        telefono: telefonoFinal,
        whatsapp: telefonoFinal,
        email: emailFinal || undefined,
        direccion: '',
        branchId: branchAsignada,
        tipoCliente: isSucursal ? 'sucursal' : 'minorista',
        activo: true,
        observaciones: isSucursal ? `Sucursal registrada - Responsable: ${contactoFinal}` : 'Registro particular desde App',
      });


      // 3. Loguear directamente al usuario con sus nuevos datos
      setClienteSession(newCustomer);

      customAlert(
        '¡Registro Exitoso!',
        isSucursal 
          ? `La sucursal "${nombreFinal}" ha sido registrada exitosamente. Ya podés realizar pedidos.`
          : `¡Bienvenido/a ${nombreFinal}! Tu cuenta ha sido creada con éxito.`
      );
    } catch (err: any) {
      console.error('Error al registrar cuenta:', err);
      setError(err?.message || 'No pudimos registrar tu cuenta en este momento. Por favor intentá nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.centerContent} keyboardShouldPersistTaps="handled">

        <Animated.View style={[styles.logoWrapper, logoAnim.animatedStyle]}>
          <View style={styles.logoBg}>
            <MaterialCommunityIcons 
              name={accountType === 'sucursal' ? 'store' : 'account-plus'} 
              size={36} 
              color={Colors.primary} 
            />
          </View>
        </Animated.View>

        <Animated.View style={titleAnim.animatedStyle}>
          <Text style={styles.loginTitle}>Crear Cuenta</Text>
          <Text style={styles.loginSub}>
            Seleccioná tu tipo de cuenta para comprar en Química General Deheza.
          </Text>
        </Animated.View>

        {/* Selector de Tipo de Cuenta */}
        <View style={styles.typeSelectorContainer}>
          <TouchableOpacity
            style={[
              styles.typeTab,
              accountType === 'consumidor_final' && styles.typeTabActive,
            ]}
            onPress={() => {
              setError(null);
              setAccountType('consumidor_final');
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="account"
              size={18}
              color={accountType === 'consumidor_final' ? Colors.white : Colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.typeTabText,
                accountType === 'consumidor_final' && styles.typeTabTextActive,
              ]}
            >
              Cliente Particular
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeTab,
              accountType === 'sucursal' && styles.typeTabActive,
            ]}
            onPress={() => {
              setError(null);
              setAccountType('sucursal');
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="storefront-outline"
              size={18}
              color={accountType === 'sucursal' ? Colors.white : Colors.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.typeTabText,
                accountType === 'sucursal' && styles.typeTabTextActive,
              ]}
            >
              Sucursal / Empresa
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Formulario Consumidor Final ── */}
        {accountType === 'consumidor_final' && (
          <View style={{ width: '100%' }}>
            <AnimatedInput
              placeholder="Nombre Completo *"
              value={regName}
              onChangeText={setRegName}
              autoCapitalize="words"
              delay={100}
            />

            <AnimatedInput
              placeholder="Teléfono Celular / WhatsApp *"
              value={regPhone}
              onChangeText={setRegPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
              delay={150}
            />

            <AnimatedInput
              placeholder="Email (Opcional)"
              value={regEmail}
              onChangeText={setRegEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              delay={200}
            />

            <AnimatedInput
              placeholder="DNI o CUIT (Opcional)"
              value={regCuit}
              onChangeText={setRegCuit}
              keyboardType="numeric"
              autoCapitalize="none"
              delay={250}
            />
          </View>
        )}

        {/* ── Formulario Sucursal ── */}
        {accountType === 'sucursal' && (
          <View style={{ width: '100%' }}>
            {availableBranches.length > 0 && (
              <View style={styles.branchSelectContainer}>
                <Text style={styles.fieldLabel}>Sucursal de referencia / abastecimiento:</Text>
                <View style={styles.branchPillsRow}>
                  {availableBranches.map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.branchPill,
                        selectedBranchId === b.id && styles.branchPillActive,
                      ]}
                      onPress={() => setSelectedBranchId(b.id)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.branchPillText,
                          selectedBranchId === b.id && styles.branchPillTextActive,
                        ]}
                      >
                        {b.nombre}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <AnimatedInput
              placeholder="Nombre de la Sucursal / Razón Social *"
              value={branchName}
              onChangeText={setBranchName}
              autoCapitalize="words"
              delay={100}
            />

            <AnimatedInput
              placeholder="Encargado / Contacto Responsable *"
              value={branchContact}
              onChangeText={setBranchContact}
              autoCapitalize="words"
              delay={150}
            />

            <AnimatedInput
              placeholder="CUIT de la Sucursal / Empresa"
              value={branchCuit}
              onChangeText={setBranchCuit}
              keyboardType="numeric"
              autoCapitalize="none"
              delay={200}
            />

            <AnimatedInput
              placeholder="Teléfono / WhatsApp de Contacto *"
              value={branchPhone}
              onChangeText={setBranchPhone}
              keyboardType="phone-pad"
              autoCapitalize="none"
              delay={250}
            />

            <AnimatedInput
              placeholder="Email Institucional / Facturación"
              value={branchEmail}
              onChangeText={setBranchEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              delay={300}
            />
          </View>
        )}

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
                  'Bienvenido a Química General Deheza.\n\n1. El uso de esta aplicación implica la aceptación de todos nuestros términos de servicio.\n2. Los precios provistos en el catálogo son orientativos y pueden variar al momento de facturación definitiva.\n3. Los repartos están sujetos a disponibilidad de stock y capacidad de franjas horarias.\n4. La entrega se realiza bajo los métodos de pago coordinados.'
                );
              }}
            >
              términos y condiciones
            </Text>
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#dc2626" style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>
              {error}
            </Text>
          </View>
        )}

        <Animated.View style={[{ width: '100%', gap: Spacing.md }, buttonAnim.animatedStyle]}>
          <TouchableOpacity 
            style={[styles.primaryButton, isLoading && { opacity: 0.7 }]} 
            onPress={handleRegister} 
            activeOpacity={0.82}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {accountType === 'sucursal' ? 'Registrar Sucursal e Ingresar' : 'Registrarme e Ingresar'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={onBack} 
            activeOpacity={0.8}
            disabled={isLoading}
          >
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
  typeSelectorContainer: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#f1f5f9',
    borderRadius: Radius.lg,
    padding: 4,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: Radius.md,
  },
  typeTabActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  typeTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  typeTabTextActive: {
    color: Colors.white,
    fontWeight: '700',
  },
  branchSelectContainer: {
    width: '100%',
    marginBottom: Spacing.md,
    backgroundColor: '#f8fafc',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  branchPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  branchPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  branchPillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  branchPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  branchPillTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
