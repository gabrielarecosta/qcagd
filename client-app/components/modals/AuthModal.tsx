import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { useAuthStore } from '../../store/authStore';
import { customAlert } from '../../utils/alert';
import { supabase } from '@shared/services/supabaseClient';
import { clientService } from '@shared/services/clientService';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'register';
}

export function AuthModal({ visible, onClose, initialTab = 'login' }: AuthModalProps) {
  const { loginAsCliente, loginAsRepartidor, lastUsername } = useAuthStore();
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [role, setRole] = useState<'cliente' | 'repartidor'>('cliente');

  // Login form state
  const [loginInput, setLoginInput] = useState(lastUsername || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [regAddress, setRegAddress] = useState('');
  const [regAcceptTerms, setRegAcceptTerms] = useState(true);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTab(initialTab);
      setLoginError(null);
      setRegError(null);
    }
  }, [visible, initialTab]);

  // Password strength checks
  const isReqMinLength = regPassword.length >= 8;
  const isReqUpper = /[A-Z]/.test(regPassword);
  const isReqNum = /\d/.test(regPassword);

  const handleLogin = async () => {
    setLoginError(null);
    const trimmedInput = loginInput.trim();
    if (!trimmedInput) {
      setLoginError('Por favor ingresá tu email o usuario.');
      return;
    }
    if (!loginPassword) {
      setLoginError('Por favor ingresá tu contraseña.');
      return;
    }

    setIsLoginLoading(true);
    try {
      let success = false;
      if (role === 'cliente') {
        success = await loginAsCliente(trimmedInput, loginPassword);
      } else {
        success = await loginAsRepartidor(trimmedInput, loginPassword);
      }

      if (success) {
        onClose();
      } else {
        setLoginError('Credenciales incorrectas. Verificá tu usuario y contraseña.');
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Error al iniciar sesión. Intentá nuevamente.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    setRegError(null);
    const trimmedName = regName.trim();
    const trimmedEmail = regEmail.trim();
    const cleanedPhone = regPhone.replace(/\D/g, '');

    if (!trimmedName) {
      setRegError('Ingresá tu nombre o razón social.');
      return;
    }
    if (!cleanedPhone || cleanedPhone.length < 8) {
      setRegError('Ingresá un número de teléfono válido (mínimo 8 dígitos).');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setRegError('Ingresá un correo electrónico válido.');
      return;
    }
    if (!isReqMinLength) {
      setRegError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setRegError('Las contraseñas no coinciden.');
      return;
    }
    if (!regAcceptTerms) {
      setRegError('Debés aceptar los términos y condiciones.');
      return;
    }

    setIsRegisterLoading(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: trimmedEmail.toLowerCase(),
        password: regPassword,
        options: {
          data: {
            nombre: trimmedName,
            telefono: cleanedPhone,
            rol: 'cliente',
          },
        },
      });

      if (authErr) {
        setRegError(authErr.message);
        setIsRegisterLoading(false);
        return;
      }

      if (!authData.user) {
        setRegError('No se pudo generar la cuenta en el sistema.');
        setIsRegisterLoading(false);
        return;
      }

      await clientService.create({
        userId: authData.user.id,
        nombre: trimmedName,
        razonSocial: trimmedName,
        telefono: cleanedPhone,
        whatsapp: cleanedPhone,
        email: trimmedEmail.toLowerCase(),
        direccion: regAddress.trim() || 'General Deheza',
        branchId: 1,
        tipoCliente: 'minorista',
        activo: true,
        passwordPlain: regPassword,
      });

      const success = await loginAsCliente(trimmedEmail.toLowerCase(), regPassword);
      if (success) {
        customAlert('¡Bienvenido!', 'Tu cuenta ha sido creada exitosamente.');
        onClose();
      } else {
        setTab('login');
        customAlert('Cuenta creada', 'Por favor ingresá con tus nuevas credenciales.');
      }
    } catch (err: any) {
      setRegError(err?.message || 'Error al crear la cuenta.');
    } finally {
      setIsRegisterLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image source={require('../../assets/logo2.png')} style={styles.logo} resizeMode="contain" />
              <View>
                <Text style={styles.brandTitle}>Química General Deheza</Text>
                <Text style={styles.brandSubtitle}>Acceso a clientes & repartidores</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tabs Selector */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
              onPress={() => { setTab('login'); setLoginError(null); }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="login"
                size={18}
                color={tab === 'login' ? Colors.primary : Colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>Iniciar sesión</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, tab === 'register' && styles.tabBtnActive]}
              onPress={() => { setTab('register'); setRegError(null); }}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="account-plus-outline"
                size={18}
                color={tab === 'register' ? Colors.primary : Colors.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>Registrarme</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[
              styles.bodyScroll,
              Platform.OS === 'web' && ({ overflowY: 'scroll' } as any),
            ]}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={true}
            persistentScrollbar={true}
            // @ts-ignore
            dataSet={{ mainScroll: 'true' }}
          >
            {/* LOGIN FORM */}
            {tab === 'login' ? (
              <View style={styles.form}>
                {/* Role Toggle */}
                <View style={styles.roleToggleRow}>
                  <TouchableOpacity
                    style={[styles.roleBtn, role === 'cliente' && styles.roleBtnActive]}
                    onPress={() => setRole('cliente')}
                  >
                    <MaterialCommunityIcons
                      name="account"
                      size={16}
                      color={role === 'cliente' ? Colors.white : Colors.textSecondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.roleText, role === 'cliente' && styles.roleTextActive]}>Soy Cliente</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.roleBtn, role === 'repartidor' && styles.roleBtnActive]}
                    onPress={() => setRole('repartidor')}
                  >
                    <MaterialCommunityIcons
                      name="truck-delivery"
                      size={16}
                      color={role === 'repartidor' ? Colors.white : Colors.textSecondary}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.roleText, role === 'repartidor' && styles.roleTextActive]}>Soy Repartidor</Text>
                  </TouchableOpacity>
                </View>

                {loginError && (
                  <View style={styles.errorBox}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                    <Text style={styles.errorText}>{loginError}</Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{role === 'cliente' ? 'Email o Usuario' : 'Usuario de Reparto'}</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="email-outline" size={18} color={Colors.textDisabled} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={loginInput}
                      onChangeText={setLoginInput}
                      placeholder={role === 'cliente' ? 'ejemplo@correo.com' : 'usuario_reparto'}
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Contraseña</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="lock-outline" size={18} color={Colors.textDisabled} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={loginPassword}
                      onChangeText={setLoginPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, isLoginLoading && styles.submitBtnDisabled]}
                  onPress={handleLogin}
                  disabled={isLoginLoading}
                  activeOpacity={0.85}
                >
                  {isLoginLoading ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>INGRESAR</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.footerHelp}>
                  <Text style={styles.footerHelpText}>¿No tenés una cuenta todavía?</Text>
                  <TouchableOpacity onPress={() => setTab('register')}>
                    <Text style={styles.footerHelpLink}>Registrate acá</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* REGISTER FORM */
              <View style={styles.form}>
                {regError && (
                  <View style={styles.errorBox}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                    <Text style={styles.errorText}>{regError}</Text>
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Nombre completo o Razón Social *</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="account-outline" size={18} color={Colors.textDisabled} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={regName}
                      onChangeText={setRegName}
                      placeholder="Juan Pérez o Mi Comercio"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Teléfono / WhatsApp *</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="whatsapp" size={18} color={Colors.textDisabled} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={regPhone}
                      onChangeText={setRegPhone}
                      placeholder="3584123456"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Correo electrónico *</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="email-outline" size={18} color={Colors.textDisabled} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={regEmail}
                      onChangeText={setRegEmail}
                      placeholder="juan@correo.com"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Dirección de entrega (Opcional)</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="map-marker-outline" size={18} color={Colors.textDisabled} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={regAddress}
                      onChangeText={setRegAddress}
                      placeholder="Calle y número, General Deheza"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Contraseña (mínimo 8 caracteres) *</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="lock-outline" size={18} color={Colors.textDisabled} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={regPassword}
                      onChangeText={setRegPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirmar contraseña *</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="lock-check-outline" size={18} color={Colors.textDisabled} style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      value={regConfirmPassword}
                      onChangeText={setRegConfirmPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                      <MaterialCommunityIcons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Terms checkbox */}
                <TouchableOpacity
                  style={styles.termsRow}
                  onPress={() => setRegAcceptTerms(!regAcceptTerms)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={regAcceptTerms ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={20}
                    color={regAcceptTerms ? Colors.primary : Colors.textDisabled}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.termsText}>
                    Acepto los términos y condiciones del servicio y tratamiento de datos para envíos.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitBtn, isRegisterLoading && styles.submitBtnDisabled]}
                  onPress={handleRegister}
                  disabled={isRegisterLoading}
                  activeOpacity={0.85}
                >
                  {isRegisterLoading ? (
                    <ActivityIndicator color={Colors.white} size="small" />
                  ) : (
                    <Text style={styles.submitBtnText}>CREAR MI CUENTA</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.footerHelp}>
                  <Text style={styles.footerHelpText}>¿Ya tenés una cuenta registrada?</Text>
                  <TouchableOpacity onPress={() => setTab('login')}>
                    <Text style={styles.footerHelpLink}>Iniciá sesión</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
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
    padding: Spacing.md,
    zIndex: 99999,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: Radius.xs,
  },
  brandTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
  },
  brandSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.xs,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: Colors.white,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    padding: Spacing.lg,
  },
  form: {
    gap: Spacing.md,
  },
  roleToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  roleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: Radius.xs,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
  },
  roleTextActive: {
    color: Colors.white,
    fontWeight: FontWeight.bold,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: Spacing.sm,
    borderRadius: Radius.xs,
  },
  errorText: {
    fontSize: FontSize.xs,
    color: '#DC2626',
    flex: 1,
    fontWeight: FontWeight.medium,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radius.xs,
    height: 42,
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    height: '100%',
    padding: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  eyeBtn: {
    padding: 4,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  termsText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xs,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  footerHelp: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerHelpText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  footerHelpLink: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
});
