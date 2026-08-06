import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  AccessibilityInfo,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { useAuthStore } from '../../store/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@shared/services/supabaseClient';

const CAROUSEL_IMAGES = [
  {
    title: 'Nuestra tienda',
    image: require('../../assets/banner.png'),
    label: 'Todo lo que ',
    labelItalic: 'necesitás',
    labelEnd: ',\nen un solo lugar.',
    subtitle: 'Limpieza, perfumería, descartables, bazar, ferretería y mucho más.',
  },
  {
    title: 'Variedad de productos',
    image: require('../../assets/1.webp'),
    label: 'Insumos de primer nivel y ',
    labelItalic: 'stock permanente',
    labelEnd: '.',
    subtitle: 'Directo de fábrica, al mejor precio para tu comercio u hogar.',
  },
  {
    title: 'Limpieza y perfumería',
    image: require('../../assets/2.jpg'),
    label: 'Fragancias y desinfectantes ',
    labelItalic: 'premium',
    labelEnd: '.',
    subtitle: 'Fórmulas concentradas de alto rendimiento y marcas seleccionadas.',
  },
  {
    title: 'Ferretería y más',
    image: require('../../assets/3.jpeg'),
    label: 'Herramientas y accesorios de ',
    labelItalic: 'calidad',
    labelEnd: '.',
    subtitle: 'Soluciones rápidas e industriales para todas tus tareas diarias.',
  },
  {
    title: 'Descartables y bazar',
    image: require('../../assets/4.webp'),
    label: 'Bazar, limpieza y embalajes ',
    labelItalic: 'descartables',
    labelEnd: '.',
    subtitle: 'Todo lo necesario para eventos, comercios, oficinas y organización del hogar.',
  },
];

export function MobileStartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const heroWidth = screenWidth - 32;
  const { loginAsCliente, loginAsRepartidor } = useAuthStore();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<'cliente' | 'repartidor'>('cliente');

  // Carousel State
  const [carouselIndex, setCarouselIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isDragging = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Form Field Error States (displayed inside the form instead of alerts)
  const [formError, setFormError] = useState<string | null>(null);

  // Login Form State
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // Register Form State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regLocalidad, setRegLocalidad] = useState('General Deheza');
  const [regAddress, setRegAddress] = useState('');
  const [regAcceptTerms, setRegAcceptTerms] = useState(true);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);

  const params = useLocalSearchParams<{ tab?: string }>();

  useEffect(() => {
    if (params.tab === 'register') {
      setTab('register');
      setFormError(null);
    } else if (params.tab === 'login') {
      setTab('login');
      setFormError(null);
    }
  }, [params.tab]);

  // Validaciones en tiempo real para contraseña
  const isReqMinLength = regPassword.length >= 12;
  const isReqMaxLength = regPassword.length <= 50 && regPassword.length > 0;
  const isReqUpper = /[A-Z]/.test(regPassword);
  const isReqNum = /\d/.test(regPassword);
  const isReqSpecial = /[^A-Za-z0-9]/.test(regPassword);

  let strengthScore = 0;
  if (isReqMinLength) strengthScore++;
  if (isReqMaxLength) strengthScore++;
  if (isReqUpper) strengthScore++;
  if (isReqNum) strengthScore++;
  if (isReqSpecial) strengthScore++;

  let strengthText = 'Débil';
  let strengthColor = '#ef4444';
  if (strengthScore >= 3 && strengthScore <= 4) {
    strengthText = 'Media';
    strengthColor = '#f59e0b';
  } else if (strengthScore === 5) {
    strengthText = 'Segura';
    strengthColor = '#10b981';
  }

  // Check prefers-reduced-motion
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      setReducedMotion(enabled);
    });
  }, []);

  // Auto-play Carousel Effect
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isDragging.current && CAROUSEL_IMAGES.length > 0) {
        const nextIdx = (carouselIndex + 1) % CAROUSEL_IMAGES.length;
        scrollRef.current?.scrollTo({
          x: nextIdx * heroWidth,
          animated: !reducedMotion,
        });
        setCarouselIndex(nextIdx);
      }
    }, 5500);

    return () => clearInterval(timer);
  }, [carouselIndex, heroWidth, reducedMotion]);

  // Handle Scroll End for Carousel
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / heroWidth);
    if (idx !== carouselIndex && idx >= 0 && idx < CAROUSEL_IMAGES.length) {
      setCarouselIndex(idx);
    }
  };

  // Handle Login submission
  const handleLogin = async () => {
    setFormError(null);
    if (!loginInput.trim()) {
      setFormError('Ingresá tu email o usuario.');
      return;
    }
    if (!loginPassword.trim()) {
      setFormError('Ingresá tu contraseña.');
      return;
    }

    setIsLoginLoading(true);
    try {
      if (role === 'repartidor') {
        const success = await loginAsRepartidor(loginInput.trim(), loginPassword.trim());
        if (!success) {
          setFormError('Los datos ingresados no son correctos.');
        }
      } else {
        const success = await loginAsCliente(loginInput.trim(), loginPassword.trim());
        if (!success) {
          setFormError('Los datos ingresados no son correctos.');
        }
      }
    } catch (e) {
      setFormError('No pudimos iniciar sesión. Intentá nuevamente.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  // Handle Register submission
  const handleRegister = async () => {
    setFormError(null);
    if (!regName.trim()) {
      setFormError('Ingresá tu nombre y apellido o comercio.');
      return;
    }

    // Email check
    const trimmedEmail = regEmail.trim();
    if (!trimmedEmail) {
      setFormError('Ingresá una dirección de correo electrónico válida.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setFormError('Ingresá una dirección de correo electrónico válida.');
      return;
    }

    // Phone check
    const cleanedPhone = regPhone.trim();
    if (!cleanedPhone) {
      setFormError('Ingresá el número con código de área, sin 0 y sin 15.');
      return;
    }
    if (!/^\d+$/.test(cleanedPhone) || cleanedPhone.startsWith('0') || cleanedPhone.length !== 10) {
      setFormError('Ingresá el número con código de área, sin 0 y sin 15.');
      return;
    }

    // Password requirements check
    if (regPassword.length < 12 || regPassword.length > 50) {
      setFormError('La contraseña debe tener entre 12 y 50 caracteres y cumplir todos los requisitos.');
      return;
    }
    if (!isReqUpper || !isReqNum || !isReqSpecial) {
      setFormError('La contraseña no cumple todos los requisitos de seguridad.');
      return;
    }

    // Passwords match check
    if (regPassword !== regConfirmPassword) {
      setFormError('Las contraseñas ingresadas deben ser iguales.');
      return;
    }

    if (!regAcceptTerms) {
      setFormError('Debés aceptar los términos y condiciones.');
      return;
    }

    setIsRegisterLoading(true);
    try {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('email', trimmedEmail.toLowerCase())
        .maybeSingle();

      if (existing) {
        setFormError('Este email ya está registrado.');
        setIsRegisterLoading(false);
        return;
      }

      const customerId = 'cust-' + Date.now();
      const { error } = await supabase.from('customers').insert({
        id: customerId,
        nombre: regName.trim(),
        razon_social: regName.trim(),
        telefono: cleanedPhone,
        whatsapp: cleanedPhone,
        email: trimmedEmail.toLowerCase(),
        direccion: regAddress.trim() || 'General Deheza',
        zona: regLocalidad.trim(),
        branch_id: 'branch-gd1',
        tipo_cliente: 'minorista',
        activo: true,
      });

      if (error) throw error;

      const success = await loginAsCliente(regName.trim());
      if (!success) {
        setFormError('No pudimos iniciar sesión automáticamente. Intentá ingresar manualmente.');
      }
    } catch (err) {
      console.error('Error registering client:', err);
      setFormError('No pudimos crear la cuenta. Intentá nuevamente.');
    } finally {
      setIsRegisterLoading(false);
    }
  };

  return (
    <View style={styles.ordersMobilePage}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* PORTADA SUPERIOR CON CARRUSEL */}
        <View style={[styles.ordersMobileHero, { width: heroWidth, marginTop: Math.max(insets.top, 16) }]}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={() => { isDragging.current = true; }}
            onScrollEndDrag={() => { isDragging.current = false; }}
            onMomentumScrollEnd={(e) => {
              isDragging.current = false;
              handleScroll(e);
            }}
            style={StyleSheet.absoluteFill}
          >
            {CAROUSEL_IMAGES.map((item, idx) => (
              <View key={idx} style={{ width: heroWidth, height: '100%' }}>
                <Image
                  source={item.image}
                  style={styles.ordersMobileCarouselImage}
                  resizeMode="cover"
                />
              </View>
            ))}
          </ScrollView>

          {/* Gradiente Overlay */}
          <View style={styles.ordersMobileOverlay} />

          {/* Etiqueta Superior Izquierda "Pedidos online" */}
          <View style={styles.topBadge}>
            <MaterialCommunityIcons name="cart-outline" size={12} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.topBadgeText}>Pedidos online</Text>
          </View>

          {/* Logo QGD en la portada superior derecha */}
          <View style={styles.compactLogoWrapper}>
            <Image
              source={require('../../assets/logo2.png')}
              style={styles.compactLogo}
              resizeMode="contain"
            />
          </View>

          {/* Contenido del carrusel */}
          <View style={styles.heroContentContainer}>
            <Text style={styles.heroTitle}>
              {CAROUSEL_IMAGES[carouselIndex].label}
              <Text style={styles.heroTitleItalic}>
                {CAROUSEL_IMAGES[carouselIndex].labelItalic}
              </Text>
              {CAROUSEL_IMAGES[carouselIndex].labelEnd}
            </Text>
            <Text style={styles.heroSubtitle}>
              {CAROUSEL_IMAGES[carouselIndex].subtitle}
            </Text>

            <View style={styles.truckRow}>
              <MaterialCommunityIcons name="truck-delivery" size={16} color="#60a5fa" style={{ marginRight: 6 }} />
              <Text style={styles.truckText}>Pedidos simples, rápidos y directos.</Text>
            </View>
          </View>

          {/* Indicadores de puntos inferiores */}
          <View style={styles.ordersMobileCarouselDots}>
            {CAROUSEL_IMAGES.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  carouselIndex === idx && styles.dotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* SECCIÓN DE IDENTIDAD */}
        <View style={styles.identityWrapper}>
          <Text style={styles.identityHeading}>
            Registrate, mirá nuestro catálogo y realizá tu pedido.
          </Text>
          <Text style={styles.identityTagline}>
            Te lo llevamos donde estés... ¡tan fácil como eso!
          </Text>
        </View>

        {/* MENSAJES DE ERROR DEL FORMULARIO */}
        {formError && (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        )}

        {/* CONTENEDOR DEL FORMULARIO */}
        <View style={styles.ordersMobileAuthCard}>
          {/* Selector de pestañas */}
          <View style={styles.ordersMobileAuthTabs}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                tab === 'login' && styles.tabButtonActive,
              ]}
              onPress={() => {
                setTab('login');
                setFormError(null);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  tab === 'login' && styles.tabButtonTextActive,
                ]}
              >
                Ingresar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                tab === 'register' && styles.tabButtonActive,
              ]}
              onPress={() => {
                setTab('register');
                setFormError(null);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  tab === 'register' && styles.tabButtonTextActive,
                ]}
              >
                Registrarme
              </Text>
            </TouchableOpacity>
          </View>

          {/* FORMULARIO DE INGRESO */}
          {tab === 'login' && (
            <View>
              {/* Rol Switcher (Cliente / Repartidor) */}
              <View style={styles.roleSwitcherRow}>
                <TouchableOpacity
                  style={[
                    styles.roleToggle,
                    role === 'cliente' && styles.roleToggleActive,
                  ]}
                  onPress={() => setRole('cliente')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleToggleText, role === 'cliente' && styles.roleToggleTextActive]}>
                    Cliente
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleToggle,
                    role === 'repartidor' && styles.roleToggleActive,
                  ]}
                  onPress={() => setRole('repartidor')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.roleToggleText, role === 'repartidor' && styles.roleToggleTextActive]}>
                    Repartidor
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Email o usuario */}
              <View style={styles.ordersMobileField}>
                <MaterialCommunityIcons name="account-outline" size={22} color="#94a3b8" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder={role === 'repartidor' ? "Código o teléfono" : "Email o usuario"}
                  placeholderTextColor="#94a3b8"
                  value={loginInput}
                  onChangeText={setLoginInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType={role === 'cliente' ? 'email-address' : 'default'}
                />
              </View>

              {/* Contraseña */}
              <View style={styles.ordersMobileField}>
                <MaterialCommunityIcons name="lock-outline" size={22} color="#94a3b8" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Contraseña"
                  placeholderTextColor="#94a3b8"
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {/* Checkbox y Olvidé mi contraseña */}
              <View style={styles.extraRow}>
                <TouchableOpacity
                  style={styles.checkboxWrapper}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={rememberMe ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={20}
                    color={rememberMe ? Colors.primary : '#94a3b8'}
                  />
                  <Text style={styles.checkboxLabel}>Recordarme</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFormError('Contactá a casa central para blanquear tu contraseña.')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                </TouchableOpacity>
              </View>

              {/* Botón Ingresar */}
              <TouchableOpacity
                style={[styles.btnPrimary, isLoginLoading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={isLoginLoading}
                activeOpacity={0.85}
              >
                {isLoginLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Ingresar</Text>
                )}
              </TouchableOpacity>

              {/* Botón Crear cuenta */}
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => {
                  setTab('register');
                  setFormError(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.btnSecondaryText}>Crear cuenta</Text>
              </TouchableOpacity>

              {/* Ver catálogo */}
              <TouchableOpacity
                style={styles.catalogLink}
                onPress={() => router.push('/(tabs)/catalogo')}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="shopping-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.catalogLinkText}>Ver catálogo</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* FORMULARIO DE REGISTRO */}
          {tab === 'register' && (
            <View>
              {/* Sección 1: Datos Personales */}
              <Text style={styles.sectionHeader}>Datos Personales</Text>
              <View style={styles.ordersMobileField}>
                <MaterialCommunityIcons name="account-outline" size={22} color="#94a3b8" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Nombre y apellido / Comercio *"
                  placeholderTextColor="#94a3b8"
                  value={regName}
                  onChangeText={setRegName}
                  autoCapitalize="words"
                />
              </View>

              {/* Sección 2: Datos de Contacto */}
              <Text style={styles.sectionHeader}>Contacto</Text>
              <View style={styles.ordersMobileField}>
                <MaterialCommunityIcons name="email-outline" size={22} color="#94a3b8" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Email *"
                  placeholderTextColor="#94a3b8"
                  value={regEmail}
                  onChangeText={setRegEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>

              <View style={[styles.ordersMobileField, { marginBottom: 4 }]}>
                <MaterialCommunityIcons name="phone-outline" size={22} color="#94a3b8" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Teléfono / WhatsApp *"
                  placeholderTextColor="#94a3b8"
                  value={regPhone}
                  onChangeText={(text) => setRegPhone(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.helpTextContainer}>
                <Text style={styles.helpText}>Ingresá el código de área y el número, sin 0 y sin 15.</Text>
                <Text style={styles.helpTextExample}>Ejemplo: 3584051234</Text>
              </View>

              {/* Sección 3: Dirección */}
              <Text style={styles.sectionHeader}>Dirección de entrega</Text>
              <View style={styles.ordersMobileField}>
                <MaterialCommunityIcons name="map-marker-outline" size={22} color="#94a3b8" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Localidad *"
                  placeholderTextColor="#94a3b8"
                  value={regLocalidad}
                  onChangeText={setRegLocalidad}
                />
              </View>

              <View style={styles.ordersMobileField}>
                <MaterialCommunityIcons name="home-outline" size={22} color="#94a3b8" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Dirección (Opcional)"
                  placeholderTextColor="#94a3b8"
                  value={regAddress}
                  onChangeText={setRegAddress}
                />
              </View>

              {/* Sección 4: Contraseñas */}
              <Text style={styles.sectionHeader}>Seguridad</Text>
              
              <View style={styles.ordersMobileField}>
                <MaterialCommunityIcons name="lock-outline" size={22} color="#94a3b8" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Contraseña *"
                  placeholderTextColor="#94a3b8"
                  value={regPassword}
                  onChangeText={setRegPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {/* Lista visual de requisitos interactivos */}
              <View style={styles.pwdRequirementsBox}>
                <Text style={styles.pwdReqTitle}>Requisitos de la contraseña:</Text>
                
                <View style={styles.pwdReqRow}>
                  <MaterialCommunityIcons 
                    name={isReqMinLength ? "check-circle" : "checkbox-blank-circle-outline"} 
                    size={16} 
                    color={isReqMinLength ? "#10b981" : "#94a3b8"} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.pwdReqText, isReqMinLength && styles.pwdReqTextChecked]}>
                    12 caracteres como mínimo.
                  </Text>
                </View>
                
                <View style={styles.pwdReqRow}>
                  <MaterialCommunityIcons 
                    name={isReqUpper ? "check-circle" : "checkbox-blank-circle-outline"} 
                    size={16} 
                    color={isReqUpper ? "#10b981" : "#94a3b8"} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.pwdReqText, isReqUpper && styles.pwdReqTextChecked]}>
                    Una letra mayúscula.
                  </Text>
                </View>

                <View style={styles.pwdReqRow}>
                  <MaterialCommunityIcons 
                    name={isReqNum ? "check-circle" : "checkbox-blank-circle-outline"} 
                    size={16} 
                    color={isReqNum ? "#10b981" : "#94a3b8"} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.pwdReqText, isReqNum && styles.pwdReqTextChecked]}>
                    Un número.
                  </Text>
                </View>

                <View style={styles.pwdReqRow}>
                  <MaterialCommunityIcons 
                    name={isReqSpecial ? "check-circle" : "checkbox-blank-circle-outline"} 
                    size={16} 
                    color={isReqSpecial ? "#10b981" : "#94a3b8"} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.pwdReqText, isReqSpecial && styles.pwdReqTextChecked]}>
                    Un signo.
                  </Text>
                </View>

                <View style={styles.pwdReqRow}>
                  <MaterialCommunityIcons 
                    name={isReqMaxLength ? "check-circle" : "checkbox-blank-circle-outline"} 
                    size={16} 
                    color={isReqMaxLength ? "#10b981" : "#94a3b8"} 
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.pwdReqText, isReqMaxLength && styles.pwdReqTextChecked]}>
                    Máximo 50 caracteres.
                  </Text>
                </View>

                {/* Indicador de Seguridad */}
                {regPassword.length > 0 && (
                  <View style={styles.strengthMeterContainer}>
                    <Text style={styles.strengthLabel}>
                      Seguridad: <Text style={{ fontWeight: 'bold', color: strengthColor }}>{strengthText}</Text>
                    </Text>
                    <View style={styles.strengthTrack}>
                      <View style={[styles.strengthBar, { width: `${(strengthScore / 5) * 100}%`, backgroundColor: strengthColor }]} />
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.ordersMobileField}>
                <MaterialCommunityIcons name="lock-outline" size={22} color="#94a3b8" style={{ marginRight: 10 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Repetir contraseña *"
                  placeholderTextColor="#94a3b8"
                  value={regConfirmPassword}
                  onChangeText={setRegConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Aceptar términos */}
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setRegAcceptTerms(!regAcceptTerms)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={regAcceptTerms ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={20}
                  color={regAcceptTerms ? Colors.primary : '#94a3b8'}
                />
                <Text style={styles.termsLabel}>Acepto los términos y condiciones</Text>
              </TouchableOpacity>

              {/* Botón Registrarme */}
              <TouchableOpacity
                style={[styles.btnPrimary, isRegisterLoading && styles.btnDisabled]}
                onPress={handleRegister}
                disabled={isRegisterLoading}
                activeOpacity={0.85}
              >
                {isRegisterLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Crear mi cuenta</Text>
                )}
              </TouchableOpacity>

              {/* Enlace volver a ingresar */}
              <TouchableOpacity
                style={styles.btnSecondary}
                onPress={() => {
                  setTab('login');
                  setFormError(null);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.btnSecondaryText}>Ya tengo cuenta · Ingresar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* BENEFICIOS */}
        <View style={styles.ordersMobileBenefits}>
          <View style={styles.benefitCard}>
            <View style={styles.benefitIconBg}>
              <MaterialCommunityIcons name="shield-check-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.benefitTextWrapper}>
              <Text style={styles.benefitTitle}>Compra segura</Text>
              <Text style={styles.benefitSub}>Tus datos protegidos</Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <View style={styles.benefitIconBg}>
              <MaterialCommunityIcons name="truck-delivery-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.benefitTextWrapper}>
              <Text style={styles.benefitTitle}>Entrega a domicilio</Text>
              <Text style={styles.benefitSub}>Rápida y confiable</Text>
            </View>
          </View>

          <View style={styles.benefitCard}>
            <View style={styles.benefitIconBg}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={24} color={Colors.primary} />
            </View>
            <View style={styles.benefitTextWrapper}>
              <Text style={styles.benefitTitle}>Llegamos a donde estés</Text>
              <Text style={styles.benefitSub}>Cobertura local</Text>
            </View>
          </View>
        </View>

        {/* Padding final para safe-area y navegadores */}
        <View style={{ height: Math.max(insets.bottom, 24) }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ordersMobilePage: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Slate 50 background (gris muy claro)
  },

  // PORTADA SUPERIOR
  ordersMobileHero: {
    height: 350,
    alignSelf: 'center',
    borderRadius: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  ordersMobileCarouselImage: {
    width: '100%',
    height: '100%',
  },
  ordersMobileOverlay: {
    ...StyleSheet.absoluteFill,
    // Oscuro en bottom, traslúcido en top, transparente en el medio
    backgroundColor: 'rgba(6, 47, 103, 0.48)',
  },
  topBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#0878E8', // Azul brillante
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
  },
  topBadgeText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    fontSize: 11,
  },
  compactLogoWrapper: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 10,
  },
  compactLogo: {
    width: 60,
    height: 30,
  },
  heroContentContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 30,
    zIndex: 5,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: FontWeight.extrabold,
    lineHeight: 34,
    marginBottom: 8,
  },
  heroTitleItalic: {
    fontStyle: 'italic',
    fontWeight: FontWeight.extrabold,
    color: '#FFD700',
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  truckRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  truckText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: FontWeight.semibold,
  },

  // Carousel dots
  ordersMobileCarouselDots: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotActive: {
    width: 16,
    backgroundColor: '#0878E8',
  },

  // SECCIÓN DE IDENTIDAD
  identityWrapper: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: 20,
  },
  fullLogo: {
    width: 200,
    height: 65,
    marginBottom: Spacing.sm,
  },
  identityHeading: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  identityTagline: {
    fontSize: 14,
    color: '#062F67',
    fontWeight: FontWeight.bold,
    textAlign: 'center',
  },

  // MENSAJES DE ERROR
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    flex: 1,
  },

  // CONTENEDOR DEL FORMULARIO
  ordersMobileAuthCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 16,
    padding: 20,
    marginBottom: Spacing.xl,
    // Sombra sutil
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  // Selector segmentado
  ordersMobileAuthTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    height: 48,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#075BC7',
    shadowColor: '#075BC7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: FontWeight.bold,
    color: '#075BC7',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },

  // Switch de roles
  roleSwitcherRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleToggle: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 7,
  },
  roleToggleActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  roleToggleText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: FontWeight.semibold,
  },
  roleToggleTextActive: {
    color: '#075BC7',
    fontWeight: FontWeight.bold,
  },

  // Input fields (54px height, 16px font-size)
  ordersMobileField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    fontSize: 16, // Previene zoom en iOS
    color: '#0F172A',
    height: '100%',
  },
  eyeButton: {
    padding: 4,
  },

  // Row de opciones extra
  extraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkboxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: FontWeight.medium,
  },
  forgotText: {
    fontSize: 13,
    color: '#075BC7',
    fontWeight: FontWeight.bold,
  },

  // Secciones del registro
  sectionHeader: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: '#075BC7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },

  // Checkbox de términos
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    marginTop: 6,
  },
  termsLabel: {
    fontSize: 13,
    color: '#64748B',
  },

  // Botones de acción
  btnPrimary: {
    backgroundColor: '#075BC7',
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#075BC7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: FontWeight.bold,
  },
  btnDisabled: {
    backgroundColor: '#93C5FD',
  },
  btnSecondary: {
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#075BC7',
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  btnSecondaryText: {
    color: '#075BC7',
    fontSize: 16,
    fontWeight: FontWeight.bold,
  },

  // Catálogo Link
  catalogLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  catalogLinkText: {
    fontSize: 14,
    color: '#075BC7',
    fontWeight: FontWeight.bold,
    textDecorationLine: 'underline',
  },

  // SECCIÓN DE BENEFICIOS
  ordersMobileBenefits: {
    paddingHorizontal: 20,
    gap: 12,
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  benefitIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  benefitTextWrapper: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: FontWeight.bold,
    color: '#0F172A',
  },
  benefitSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  helpTextContainer: {
    paddingHorizontal: 8,
    marginBottom: Spacing.md,
  },
  helpText: {
    fontSize: 11,
    color: '#64748B',
  },
  helpTextExample: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: Colors.primary,
    marginTop: 1,
  },
  pwdRequirementsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.md,
    width: '100%',
  },
  pwdReqTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  pwdReqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pwdReqText: {
    fontSize: FontSize.sm - 2,
    color: '#64748B',
  },
  pwdReqTextChecked: {
    color: '#10b981',
    fontWeight: FontWeight.semibold,
  },
  strengthMeterContainer: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: Spacing.sm,
  },
  strengthLabel: {
    fontSize: FontSize.sm - 2,
    color: '#64748B',
    marginBottom: 4,
  },
  strengthTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
    borderRadius: 3,
  },
} as any);
