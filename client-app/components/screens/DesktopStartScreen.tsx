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
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { useAuthStore } from '../../store/authStore';
import { customAlert } from '../../utils/alert';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@shared/services/supabaseClient';

const CAROUSEL_IMAGES = [
  {
    title: 'Nuestra tienda',
    image: require('../../assets/banner.png'),
    label: 'Todo lo que ',
    labelItalic: 'necesitás',
    labelEnd: ',\nen un solo lugar.',
    subtitle: 'Artículos de limpieza, perfumería, descartables, bazar, ferretería y mucho más.',
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
    subtitle: 'Soluciones rápidas e industriales para todas tus tareas de mantenimiento.',
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

export function DesktopStartScreen() {
  const router = useRouter();
  const { loginAsCliente, loginAsRepartidor, lastUsername, sessionExpired } = useAuthStore();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  
  // Carousel State
  const [carouselIndex, setCarouselIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<any>(null);
  const isHovered = useRef(false);

  // Login Form State
  const [loginInput, setLoginInput] = useState(lastUsername || '');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginRole, setLoginRole] = useState<'cliente' | 'repartidor'>('cliente');

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
    } else if (params.tab === 'login') {
      setTab('login');
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

  // Auto-play Carousel Effect
  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [carouselIndex]);

  const startTimer = () => {
    stopTimer();
    timerRef.current = setInterval(() => {
      if (!isHovered.current) {
        changeSlide((carouselIndex + 1) % CAROUSEL_IMAGES.length);
      }
    }, 5500);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const changeSlide = (toIdx: number) => {
    Animated.timing(fadeAnim, {
      toValue: 0.1,
      duration: 350,
      useNativeDriver: false,
    }).start(() => {
      setCarouselIndex(toIdx);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: false,
      }).start();
    });
  };

  const nextSlide = () => changeSlide((carouselIndex + 1) % CAROUSEL_IMAGES.length);
  const prevSlide = () => changeSlide((carouselIndex - 1 + CAROUSEL_IMAGES.length) % CAROUSEL_IMAGES.length);

  // Handle Login submission
  const handleLogin = async () => {
    if (!loginInput.trim()) {
      customAlert('Ingreso requerido', 'Ingresá tu email o usuario.');
      return;
    }
    if (!loginPassword.trim()) {
      customAlert('Ingreso requerido', 'Ingresá tu contraseña.');
      return;
    }

    setIsLoginLoading(true);
    try {
      let success = false;
      if (loginRole === 'cliente') {
        success = await loginAsCliente(loginInput, loginPassword);
      } else {
        success = await loginAsRepartidor(loginInput, loginPassword);
      }

      if (!success) {
        customAlert('Error de ingreso', 'Los datos ingresados no son correctos.');
      }
    } catch (e) {
      customAlert('Error', 'No pudimos iniciar sesión. Intentá nuevamente.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  // Handle Register submission
  const handleRegister = async () => {
    if (!regName.trim()) {
      customAlert('Campos requeridos', 'Por favor ingresá tu nombre o razón social.');
      return;
    }

    // Email check
    const trimmedEmail = regEmail.trim();
    if (!trimmedEmail) {
      customAlert('Email requerido', 'Ingresá una dirección de correo electrónico válida.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      customAlert('Email inválido', 'Ingresá una dirección de correo electrónico válida.');
      return;
    }

    // Phone check
    const cleanedPhone = regPhone.trim();
    if (!cleanedPhone) {
      customAlert('Teléfono requerido', 'Ingresá el número con código de área, sin 0 y sin 15.');
      return;
    }
    if (!/^\d+$/.test(cleanedPhone) || cleanedPhone.startsWith('0') || cleanedPhone.length !== 10) {
      customAlert('Teléfono inválido', 'Ingresá el número con código de área, sin 0 y sin 15.');
      return;
    }

    // Password requirements check
    if (regPassword.length < 12 || regPassword.length > 50) {
      customAlert('Contraseña inválida', 'La contraseña debe tener entre 12 y 50 caracteres.');
      return;
    }
    if (!isReqUpper || !isReqNum || !isReqSpecial) {
      customAlert('Contraseña insegura', 'La contraseña no cumple todos los requisitos de seguridad.');
      return;
    }

    // Passwords match check
    if (regPassword !== regConfirmPassword) {
      customAlert('Contraseñas no coinciden', 'Las contraseñas ingresadas deben ser iguales.');
      return;
    }

    if (!regAcceptTerms) {
      customAlert('Términos y condiciones', 'Debés aceptar los términos y condiciones para registrarte.');
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
        customAlert('Email registrado', 'Este email ya se encuentra registrado.');
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
      if (success) {
        customAlert('Registro Exitoso', 'La cuenta fue creada correctamente.');
      } else {
        customAlert('Error de ingreso', 'No pudimos iniciar sesión automáticamente. Intentá ingresar manualmente.');
      }
    } catch (err) {
      console.error('Error in registration:', err);
      customAlert('Error', 'No pudimos crear la cuenta. Intentá nuevamente.');
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const activeImage = CAROUSEL_IMAGES[carouselIndex];

  return (
    <View style={styles.screenBg}>
      <View style={styles.mainCard}>
        {/* LADO IZQUIERDO: Portada y Carrusel (62% ancho) */}
        <View
          style={styles.leftColumn}
          // @ts-ignore (hover listener supporting web)
          onMouseEnter={() => { isHovered.current = true; }}
          onMouseLeave={() => { isHovered.current = false; }}
        >
          {/* Imagen de fondo del carrusel */}
          <Animated.View style={[styles.carouselContainer, { opacity: fadeAnim }]}>
            <Image
              source={activeImage.image}
              style={styles.carouselBgImage}
              resizeMode="cover"
            />
          </Animated.View>

          {/* Gradiente Overlay */}
          <View style={styles.carouselOverlay} />

          {/* Etiqueta Superior "Pedidos online" */}
          <View style={styles.topBadge}>
            <MaterialCommunityIcons name="cart-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.topBadgeText}>Pedidos online</Text>
          </View>

          {/* Contenido de Portada */}
          <Animated.View style={[styles.carouselContent, { opacity: fadeAnim }]}>
            <Text style={styles.carouselTitle}>
              {activeImage.label}
              <Text style={styles.carouselTitleItalic}>{activeImage.labelItalic}</Text>
              {activeImage.labelEnd}
            </Text>
            <Text style={styles.carouselSub}>
              {activeImage.subtitle}
            </Text>

            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="truck-delivery" size={18} color="#60a5fa" style={{ marginRight: 8 }} />
              <Text style={styles.infoRowText}>Pedidos simples, rápidos y directos.</Text>
            </View>
          </Animated.View>

          {/* Controles de Flechas */}
          <TouchableOpacity style={[styles.arrowBtn, styles.arrowLeft]} onPress={prevSlide} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.arrowBtn, styles.arrowRight]} onPress={nextSlide} activeOpacity={0.7}>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Indicadores de Puntos Inferiores */}
          <View style={styles.dotsContainer}>
            {CAROUSEL_IMAGES.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => changeSlide(idx)}
                style={[styles.dot, carouselIndex === idx && styles.dotActive]}
                activeOpacity={0.8}
              />
            ))}
          </View>

          {/* Fila de Miniaturas Inferiores clicables */}
          <View style={styles.thumbnailsContainer}>
            {CAROUSEL_IMAGES.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => changeSlide(idx)}
                style={[styles.thumbCard, carouselIndex === idx && styles.thumbCardActive]}
                activeOpacity={0.8}
              >
                <Image source={item.image} style={styles.thumbImage} resizeMode="cover" />
                <Text style={[styles.thumbLabel, carouselIndex === idx && styles.thumbLabelActive]} numberOfLines={1}>
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* LADO DERECHO: Identidad y Login/Registro (38% ancho) */}
        <View style={styles.rightColumn}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.authScroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo de la empresa */}
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoSubtext}>
                Registrate, mirá nuestro catálogo y realizá tu pedido.
              </Text>
              <Text style={styles.logoBadgeText}>
                Te lo llevamos donde estés... ¡tan fácil como eso!
              </Text>
            </View>

            {/* Selector de Pestañas (Ingresar / Registrarme) */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                onPress={() => setTab('login')}
                style={[styles.tabButton, tab === 'login' && styles.tabButtonActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabButtonText, tab === 'login' && styles.tabButtonTextActive]}>
                  Ingresar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTab('register')}
                style={[styles.tabButton, tab === 'register' && styles.tabButtonActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.tabButtonText, tab === 'register' && styles.tabButtonTextActive]}>
                  Registrarme
                </Text>
              </TouchableOpacity>
            </View>

            {/* FORMULARIO DE INGRESO */}
            {tab === 'login' && (
              <View style={styles.formContainer}>
                {sessionExpired && (
                  <View style={styles.expiredBanner}>
                    <MaterialCommunityIcons name="alert-circle" size={18} color="#b45309" style={{ marginRight: 8 }} />
                    <Text style={styles.expiredText}>
                      Tu sesión expiró por inactividad. Por favor, ingresá nuevamente.
                    </Text>
                  </View>
                )}

                {/* Switcher de rol */}
                <View style={styles.roleSwitcherContainer}>
                  <TouchableOpacity
                    style={[styles.roleTabButton, loginRole === 'cliente' && styles.roleTabButtonActive]}
                    onPress={() => setLoginRole('cliente')}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons 
                      name="account" 
                      size={18} 
                      color={loginRole === 'cliente' ? Colors.primary : '#64748b'} 
                      style={{ marginRight: 6 }} 
                    />
                    <Text style={[styles.roleTabButtonText, loginRole === 'cliente' && styles.roleTabButtonTextActive]}>
                      Cliente
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.roleTabButton, loginRole === 'repartidor' && styles.roleTabButtonActive]}
                    onPress={() => setLoginRole('repartidor')}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons 
                      name="truck-delivery" 
                      size={18} 
                      color={loginRole === 'repartidor' ? Colors.primary : '#64748b'} 
                      style={{ marginRight: 6 }} 
                    />
                    <Text style={[styles.roleTabButtonText, loginRole === 'repartidor' && styles.roleTabButtonTextActive]}>
                      Repartidor
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Email / Usuario */}
                <View style={styles.inputFieldWrapper}>
                  <MaterialCommunityIcons name="account-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Email o usuario"
                    placeholderTextColor="#94a3b8"
                    value={loginInput}
                    onChangeText={setLoginInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Contraseña */}
                <View style={styles.inputFieldWrapper}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Contraseña"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPassword}
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                {/* Recordarme / Olvidé contraseña */}
                <View style={styles.formRow}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
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
                    onPress={() => customAlert('Recuperar clave', 'Por favor, contactá a soporte o casa central para blanquear tu contraseña.')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                  </TouchableOpacity>
                </View>

                {/* Botones de acción */}
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

                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => setTab('register')}
                  activeOpacity={0.82}
                >
                  <Text style={styles.btnSecondaryText}>Crear cuenta</Text>
                </TouchableOpacity>

                {/* Enlace ver catálogo */}
                <TouchableOpacity
                  style={styles.catalogLinkRow}
                  onPress={() => router.push('/(tabs)/catalogo')}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="shopping-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.catalogLinkText}>Ver catálogo</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* FORMULARIO DE REGISTRO */}
            {tab === 'register' && (
              <View style={styles.formContainer}>
                {/* Nombre */}
                <View style={styles.inputFieldWrapper}>
                  <MaterialCommunityIcons name="account-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Nombre y apellido / Comercio *"
                    placeholderTextColor="#94a3b8"
                    value={regName}
                    onChangeText={setRegName}
                    autoCapitalize="words"
                  />
                </View>

                {/* Email */}
                <View style={styles.inputFieldWrapper}>
                  <MaterialCommunityIcons name="email-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Email *"
                    placeholderTextColor="#94a3b8"
                    value={regEmail}
                    onChangeText={setRegEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                </View>

                {/* Teléfono */}
                <View style={[styles.inputFieldWrapper, { marginBottom: 4 }]}>
                  <MaterialCommunityIcons name="phone-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
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

                {/* Localidad */}
                <View style={styles.inputFieldWrapper}>
                  <MaterialCommunityIcons name="map-marker-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Localidad *"
                    placeholderTextColor="#94a3b8"
                    value={regLocalidad}
                    onChangeText={setRegLocalidad}
                  />
                </View>

                {/* Dirección */}
                <View style={styles.inputFieldWrapper}>
                  <MaterialCommunityIcons name="home-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Dirección (Opcional)"
                    placeholderTextColor="#94a3b8"
                    value={regAddress}
                    onChangeText={setRegAddress}
                  />
                </View>

                {/* Contraseña */}
                <View style={styles.inputFieldWrapper}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Contraseña *"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPassword}
                    value={regPassword}
                    onChangeText={setRegPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94a3b8" />
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

                {/* Confirmar Contraseña */}
                <View style={styles.inputFieldWrapper}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput
                    style={styles.inputField}
                    placeholder="Repetir contraseña *"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry={!showPassword}
                    value={regConfirmPassword}
                    onChangeText={setRegConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Aceptar Términos */}
                <TouchableOpacity
                  style={[styles.checkboxRow, { marginBottom: Spacing.lg }]}
                  onPress={() => setRegAcceptTerms(!regAcceptTerms)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={regAcceptTerms ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={20}
                    color={regAcceptTerms ? Colors.primary : '#94a3b8'}
                  />
                  <Text style={styles.checkboxLabel}>Acepto los términos y condiciones</Text>
                </TouchableOpacity>

                {/* Botón de envío */}
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

                <TouchableOpacity
                  style={[styles.btnSecondary, { marginBottom: Spacing.lg }]}
                  onPress={() => setTab('login')}
                  activeOpacity={0.82}
                >
                  <Text style={styles.btnSecondaryText}>Ya tengo cuenta · Ingresar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* PIE DE AUTENTICACIÓN: Beneficios */}
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitCard}>
                <MaterialCommunityIcons name="shield-check-outline" size={22} color={Colors.primary} />
                <View style={styles.benefitTextCol}>
                  <Text style={styles.benefitTitle}>Compra segura</Text>
                  <Text style={styles.benefitSub}>Tus datos protegidos</Text>
                </View>
              </View>

              <View style={styles.benefitCard}>
                <MaterialCommunityIcons name="truck-delivery-outline" size={22} color={Colors.primary} />
                <View style={styles.benefitTextCol}>
                  <Text style={styles.benefitTitle}>Entrega a domicilio</Text>
                  <Text style={styles.benefitSub}>Rápida y confiable</Text>
                </View>
              </View>

              <View style={styles.benefitCard}>
                <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color={Colors.primary} />
                <View style={styles.benefitTextCol}>
                  <Text style={styles.benefitTitle}>Llegamos a donde estés</Text>
                  <Text style={styles.benefitSub}>Cobertura local</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({

  screenBg: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '100%',
  },
  mainCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },

  // COLUMN 1: LEFT CAROUSEL (62% width)
  leftColumn: {
    width: '62%',
    position: 'relative',
    overflow: 'hidden',
  },
  carouselContainer: {
    ...StyleSheet.absoluteFill,
  },
  carouselBgImage: {
    width: '100%',
    height: '100%',
  },
  carouselOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(6, 47, 103, 0.45)', // Capa superpuesta azul oscuro translúcido
  },
  topBadge: {
    position: 'absolute',
    top: 28,
    left: 28,
    backgroundColor: '#0878E8', // Azul brillante
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 10,
  },
  topBadgeText: {
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
    fontSize: 14,
  },
  carouselContent: {
    position: 'absolute',
    left: 45,
    bottom: 220,
    right: 45,
    zIndex: 5,
  },
  carouselTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: FontWeight.extrabold,
    lineHeight: 46,
    marginBottom: 16,
  },
  carouselTitleItalic: {
    fontStyle: 'italic',
    fontWeight: FontWeight.extrabold,
    color: '#FFD700', // Gold highlighting for emphasis
  },
  carouselSub: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
    maxWidth: 500,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoRowText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: FontWeight.semibold,
  },

  // Nav Arrows
  arrowBtn: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    top: '42%',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  arrowLeft: {
    left: 20,
  },
  arrowRight: {
    right: 20,
  },

  // Dots
  dotsContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignSelf: 'center',
    bottom: 175,
    zIndex: 10,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    width: 24,
    backgroundColor: '#0878E8', // Azul brillante
  },

  // Bottom click previews row
  thumbnailsContainer: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
    gap: 12,
  },
  thumbCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 6,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  thumbCardActive: {
    borderColor: '#075BC7', // Borde azul cuando está activa
  },
  thumbImage: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    marginBottom: 4,
  },
  thumbLabel: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
    color: '#667085',
    textAlign: 'center',
    width: '100%',
  },
  thumbLabelActive: {
    color: '#075BC7',
  },

  // COLUMN 2: RIGHT AUTH PANEL (38% width)
  rightColumn: {
    width: '38%',
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#D9E0EA',
  },
  authScroll: {
    flexGrow: 1,
    paddingVertical: 40,
    paddingHorizontal: 36,
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 140,
    height: 60,
    marginBottom: 12,
  },
  logoSubtext: {
    fontSize: 14,
    color: '#667085',
    textAlign: 'center',
    marginBottom: 6,
  },
  logoBadgeText: {
    fontSize: 14,
    color: '#062F67', // azul oscuro
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Selector Tab buttons
  tabsContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#D9E0EA',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    backgroundColor: '#F5F7FA',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#075BC7', // azul principal
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: FontWeight.bold,
    color: '#075BC7',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },

  // Form Fields
  formContainer: {
    width: '100%',
  },
  inputFieldWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D9E0EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: '#13213C',
    height: '100%',
    outlineStyle: 'none', // removes web blue border
  },
  eyeBtn: {
    padding: 6,
  },

  // Remember row
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#667085',
    fontWeight: FontWeight.medium,
  },
  forgotText: {
    fontSize: 14,
    color: '#075BC7',
    fontWeight: FontWeight.semibold,
  },

  // Form Buttons
  btnPrimary: {
    backgroundColor: '#075BC7',
    height: 52,
    borderRadius: 12,
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
    backgroundColor: '#93c5fd',
  },
  btnSecondary: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#075BC7',
    marginBottom: 20,
  },
  btnSecondaryText: {
    color: '#075BC7',
    fontSize: 16,
    fontWeight: FontWeight.bold,
  },

  // Catalogue link
  catalogLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 30,
  },
  catalogLinkText: {
    fontSize: 14,
    color: '#075BC7',
    fontWeight: FontWeight.bold,
    textDecorationLine: 'underline',
  },

  // Bottom Benefits
  benefitsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 24,
    gap: 16,
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitTextCol: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: FontWeight.bold,
    color: '#13213C', // Texto principal
  },
  benefitSub: {
    fontSize: 11,
    color: '#667085', // Texto secundario
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
  eyeButton: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
  roleSwitcherContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  roleTabButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  roleTabButtonActive: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  roleTabButtonText: {
    fontSize: 14,
    fontWeight: FontWeight.semibold,
    color: '#64748b',
  },
  roleTabButtonTextActive: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.bold,
  },
} as any);
