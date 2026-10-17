import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Platform,
  useWindowDimensions,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { clientService } from '@shared/services/clientService';
import { supabase } from '@shared/services/supabaseClient';
import MaterialCommunityIcons from '../../components/icons/MaterialCommunityIcons';
import { AppFooter } from '../../components/AppFooter';

const BUSINESS_RUBROS = [
  'Lavadero (Autos / Ropa)',
  'Distribuidora / Revendedor',
  'Supermercado / Autoservicio / Almacén',
  'Gastronomía / Hotelería',
  'Institución / Empresa de Limpieza',
  'Taller / Industria',
  'Otro Comercio',
];

const ESTIMATED_VOLUMES = [
  'Menos de $300.000 / mes',
  'Entre $300.000 y $800.000 / mes',
  'Más de $800.000 / mes',
];

export default function MayoristasScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const [formData, setFormData] = useState({
    nombre: '',
    dni: '',
    razonSocial: '',
    cuit: '',
    rubro: BUSINESS_RUBROS[0],
    telefono: '',
    email: '',
    direccion: '',
    localidad: 'General Deheza',
    provincia: 'Córdoba',
    volumen: ESTIMATED_VOLUMES[0],
    notas: '',
    password: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async () => {
    // Validaciones
    if (!formData.nombre.trim()) {
      setErrorMessage('Por favor, ingresá el nombre y apellido del titular o contacto.');
      return;
    }
    if (!formData.razonSocial.trim()) {
      setErrorMessage('Por favor, ingresá la Razón Social o Nombre del local comercial.');
      return;
    }
    if (!formData.cuit.trim()) {
      setErrorMessage('Por favor, ingresá el CUIT o CUIL comercial.');
      return;
    }
    if (!formData.telefono.trim()) {
      setErrorMessage('Por favor, ingresá un teléfono o WhatsApp de contacto.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMessage('Por favor, ingresá un correo electrónico válido.');
      return;
    }
    if (!formData.direccion.trim()) {
      setErrorMessage('Por favor, ingresá la dirección comercial de entrega.');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres para tu cuenta.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const emailClean = formData.email.trim().toLowerCase();

      // 1. Intentar registrar usuario en Supabase Auth
      let authUserId: string | null = null;
      try {
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: emailClean,
          password: formData.password,
          options: {
            data: {
              nombre: formData.nombre.trim(),
              role: 'cliente',
              tipo_cliente: 'mayorista',
            },
          },
        });
        if (authData?.user) {
          authUserId = authData.user.id;
        } else if (authErr && !authErr.message?.includes('already registered')) {
          console.warn('Auth signup warning:', authErr.message);
        }
      } catch (authCatch) {
        console.warn('Supabase Auth error ignored, procediendo a cliente DB:', authCatch);
      }

      // 2. Crear registro en la tabla customers con tipo_cliente: 'mayorista' y mayorista_autorizado: false
      const applicationObservation = `[SOLICITUD ADMISIÓN MAYORISTA] Rubro: ${formData.rubro} | Vol. Estimado: ${formData.volumen} | DNI: ${formData.dni || 'S/D'}${formData.notas ? ` | Notas: ${formData.notas.trim()}` : ''}`;

      const newCust = await clientService.create({
        userId: authUserId || undefined,
        nombre: formData.nombre.trim(),
        razonSocial: formData.razonSocial.trim(),
        cuit: formData.cuit.trim(),
        telefono: formData.telefono.trim(),
        whatsapp: formData.telefono.trim(),
        email: emailClean,
        authEmail: emailClean,
        direccion: formData.direccion.trim(),
        localidad: formData.localidad.trim() || 'General Deheza',
        branchId: 1,
        tipoCliente: 'mayorista',
        mayoristaAutorizado: false, // El admin debe aceptarlo en su panel
        ctaCteAutorizada: false,
        activo: true,
        observaciones: applicationObservation,
        passwordPlain: formData.password,
      });

      // 3. Registrar en wholesale_applications para historial y auditoría
      try {
        await supabase.from('wholesale_applications').insert({
          customer_id: newCust?.id && !isNaN(Number(newCust.id)) ? Number(newCust.id) : null,
          nombre: formData.nombre.trim(),
          dni: formData.dni.trim() || null,
          razon_social: formData.razonSocial.trim(),
          cuit: formData.cuit.trim(),
          rubro: formData.rubro,
          telefono: formData.telefono.trim(),
          email: emailClean,
          direccion: formData.direccion.trim(),
          localidad: formData.localidad.trim() || 'General Deheza',
          provincia: formData.provincia.trim() || 'Córdoba',
          volumen_estimado: formData.volumen,
          notas: formData.notas.trim() || null,
          estado: 'pendiente',
        });
      } catch (appErr) {
        console.warn('Nota: tabla wholesale_applications aún no migrada o ya registrada:', appErr);
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error('Error submitting wholesale application:', err);
      setErrorMessage(err?.message || 'Ocurrió un error al enviar tu solicitud. Por favor reintentá.');
    } finally {
      setIsLoading(false);
    }
  };

  const openWhatsAppHelp = () => {
    const text = encodeURIComponent(`Hola! Acabo de completar el formulario de admisión mayorista para ${formData.razonSocial || 'mi negocio'}. ¿Me podrían confirmar la recepción?`);
    Linking.openURL(`https://wa.me/5493584123456?text=${text}`).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ======================================================== */}
        {/* HEADER / HERO DEL PORTAL MAYORISTA                       */}
        {/* ======================================================== */}
        <View style={styles.heroBanner}>
          <View style={[styles.heroBannerInner, isDesktop && styles.heroBannerInnerDesktop]}>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="shield-star-outline" size={14} color="#BFDBFE" style={{ marginRight: 6 }} />
              <Text style={styles.heroBadgeText}>PORTAL B2B · VENTA MAYORISTA Y DISTRIBUCIÓN</Text>
            </View>

            <Text style={styles.heroTitle}>Portal Mayorista Química General Deheza</Text>
            <Text style={styles.heroSubtitle}>
              Equipá tu comercio, lavadero, empresa o distribuidora con productos químicos de fabricación propia,
              listas de precios diferenciales por bultos cerrados y logística programada.
            </Text>
          </View>
        </View>

        {/* ======================================================== */}
        {/* PILARES DEL SERVICIO MAYORISTA                            */}
        {/* ======================================================== */}
        <View style={styles.pillarsSection}>
          <View style={[styles.pillarsGrid, isDesktop && styles.pillarsGridDesktop]}>
            <View style={styles.pillarCard}>
              <View style={[styles.pillarIconWrap, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <MaterialCommunityIcons name="factory" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.pillarTitle}>Directo de Fábrica</Text>
              <Text style={styles.pillarDesc}>
                Sin intermediarios. Máxima pureza y rendimiento en lavandería, desinfección y limpieza profunda.
              </Text>
            </View>

            <View style={styles.pillarCard}>
              <View style={[styles.pillarIconWrap, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <MaterialCommunityIcons name="tag-multiple" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.pillarTitle}>Precios por Bulto Cerrado</Text>
              <Text style={styles.pillarDesc}>
                Escala de descuentos por cantidad y márgenes ideales para revendedores y comercios minoristas.
              </Text>
            </View>

            <View style={styles.pillarCard}>
              <View style={[styles.pillarIconWrap, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <MaterialCommunityIcons name="truck-fast" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.pillarTitle}>Reparto Programado</Text>
              <Text style={styles.pillarDesc}>
                Logística propia con entregas coordinadas en General Deheza y localidades de la zona.
              </Text>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* FORMULARIO DE ADMISIÓN O CONFIRMACIÓN                    */}
        {/* ======================================================== */}
        <View style={styles.formSection}>
          {submitted ? (
            <View style={styles.successCard}>
              <View style={styles.successIconWrap}>
                <MaterialCommunityIcons name="check-decagram" size={64} color="#16A34A" />
              </View>
              <Text style={styles.successTitle}>¡Solicitud de Admisión Enviada con Éxito!</Text>
              <Text style={styles.successDesc}>
                Hemos recibido los datos de <Text style={{ fontWeight: 'bold' }}>{formData.razonSocial}</Text>.
                Tu solicitud ya aparece en el panel de administración para ser evaluada y aprobada por nuestro equipo comercial.
              </Text>
              <Text style={styles.successSubDesc}>
                Una vez habilitada tu cuenta mayorista, podrás iniciar sesión con tu correo{' '}
                <Text style={{ fontWeight: 'bold' }}>{formData.email}</Text> para acceder a la lista con precios diferenciales.
              </Text>

              <View style={styles.successActionsRow}>
                <TouchableOpacity
                  style={styles.primaryActionBtn}
                  onPress={() => router.push('/(tabs)/catalogo' as any)}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="view-grid-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryActionBtnText}>Explorar Catálogo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.whatsappActionBtn}
                  onPress={openWhatsAppHelp}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.whatsappActionBtnText}>Avisar por WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={[styles.formCard, isDesktop && styles.formCardDesktop]}>
              <View style={styles.formCardHeader}>
                <View style={styles.formCardBadge}>
                  <Text style={styles.formCardBadgeText}>PASO 1 DE 1</Text>
                </View>
                <Text style={styles.formCardTitle}>Formulario de Admisión Mayorista</Text>
                <Text style={styles.formCardSubtitle}>
                  Completá tus datos comerciales. Al recibir tu solicitud, el administrador verificará tu perfil para autorizar tu lista de precios mayorista.
                </Text>
              </View>

              {errorMessage && (
                <View style={styles.errorBanner}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </View>
              )}

              {/* SECCIÓN 1: DATOS DEL COMERCIO */}
              <View style={styles.formGroupSection}>
                <Text style={styles.formSectionLegend}>1. Datos del Comercio o Negocio</Text>

                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>Razón Social o Nombre Comercial del Local *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ej: Lavadero El Sol / Distribuidora Deheza"
                    placeholderTextColor="#94A3B8"
                    value={formData.razonSocial}
                    onChangeText={v => handleChange('razonSocial', v)}
                  />
                </View>

                <View style={[styles.twoColRow, isDesktop && styles.twoColRowDesktop]}>
                  <View style={[styles.inputField, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>CUIT / CUIL Comercial *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ej: 30-12345678-9"
                      placeholderTextColor="#94A3B8"
                      value={formData.cuit}
                      onChangeText={v => handleChange('cuit', v)}
                    />
                  </View>

                  <View style={[styles.inputField, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Rubro de Actividad *</Text>
                    <View style={styles.rubroPillsWrap}>
                      {BUSINESS_RUBROS.map(r => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.rubroPill, formData.rubro === r && styles.rubroPillActive]}
                          onPress={() => handleChange('rubro', r)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.rubroPillText, formData.rubro === r && styles.rubroPillTextActive]}>
                            {r}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </View>

              {/* SECCIÓN 2: DATOS DEL TITULAR / CONTACTO */}
              <View style={styles.formGroupSection}>
                <Text style={styles.formSectionLegend}>2. Datos del Titular y Contacto</Text>

                <View style={[styles.twoColRow, isDesktop && styles.twoColRowDesktop]}>
                  <View style={[styles.inputField, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Nombre y Apellido del Responsable *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ej: Juan Pérez"
                      placeholderTextColor="#94A3B8"
                      value={formData.nombre}
                      onChangeText={v => handleChange('nombre', v)}
                    />
                  </View>

                  <View style={[styles.inputField, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>DNI o CUIL Personal (opcional)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ej: 35123456"
                      placeholderTextColor="#94A3B8"
                      value={formData.dni}
                      onChangeText={v => handleChange('dni', v)}
                    />
                  </View>
                </View>

                <View style={[styles.twoColRow, isDesktop && styles.twoColRowDesktop]}>
                  <View style={[styles.inputField, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Teléfono / WhatsApp de Contacto *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ej: 3584123456"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      value={formData.telefono}
                      onChangeText={v => handleChange('telefono', v)}
                    />
                  </View>

                  <View style={[styles.inputField, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Correo Electrónico (será tu usuario) *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ej: compras@miempresa.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={formData.email}
                      onChangeText={v => handleChange('email', v)}
                    />
                  </View>
                </View>
              </View>

              {/* SECCIÓN 3: UBICACIÓN Y LOGÍSTICA */}
              <View style={styles.formGroupSection}>
                <Text style={styles.formSectionLegend}>3. Ubicación y Entrega</Text>

                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>Dirección Comercial (Calle y Altura) *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ej: Av. San Martín 450"
                    placeholderTextColor="#94A3B8"
                    value={formData.direccion}
                    onChangeText={v => handleChange('direccion', v)}
                  />
                </View>

                <View style={[styles.twoColRow, isDesktop && styles.twoColRowDesktop]}>
                  <View style={[styles.inputField, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Localidad *</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ej: General Deheza"
                      placeholderTextColor="#94A3B8"
                      value={formData.localidad}
                      onChangeText={v => handleChange('localidad', v)}
                    />
                  </View>

                  <View style={[styles.inputField, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Provincia</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Córdoba"
                      placeholderTextColor="#94A3B8"
                      value={formData.provincia}
                      onChangeText={v => handleChange('provincia', v)}
                    />
                  </View>
                </View>
              </View>

              {/* SECCIÓN 4: ESTIMACIÓN DE COMPRA Y CONTRASEÑA */}
              <View style={styles.formGroupSection}>
                <Text style={styles.formSectionLegend}>4. Perfil de Compra y Seguridad</Text>

                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>Volumen Estimado de Compra Mensual</Text>
                  <View style={styles.rubroPillsWrap}>
                    {ESTIMATED_VOLUMES.map(vol => (
                      <TouchableOpacity
                        key={vol}
                        style={[styles.rubroPill, formData.volumen === vol && styles.rubroPillActive]}
                        onPress={() => handleChange('volumen', vol)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.rubroPillText, formData.volumen === vol && styles.rubroPillTextActive]}>
                          {vol}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>Contraseña para tu cuenta mayorista *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry
                    value={formData.password}
                    onChangeText={v => handleChange('password', v)}
                  />
                </View>

                <View style={styles.inputField}>
                  <Text style={styles.inputLabel}>Comentarios o requerimientos específicos (opcional)</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    placeholder="Detallá si necesitás factura A, tipos de productos que más consumís, etc."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={3}
                    value={formData.notas}
                    onChangeText={v => handleChange('notas', v)}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={isLoading}
                activeOpacity={0.88}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="send-check-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>Enviar Formulario de Admisión Mayorista</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.privacyNote}>
                🔒 Al enviar tu formulario, tus datos serán tratados confidencialmente para la apertura de legajo comercial en Química General Deheza.
              </Text>
            </View>
          )}
        </View>

        <AppFooter />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.huge,
  },

  // Hero Banner
  heroBanner: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#1746B3',
  },
  heroBannerInner: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  heroBannerInnerDesktop: {
    paddingVertical: Spacing.md,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.xs,
    marginBottom: Spacing.md,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 36,
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    fontSize: FontSize.md,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 24,
  },

  // Pilares
  pillarsSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: -Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  pillarsGrid: {
    gap: 14,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  pillarsGridDesktop: {
    flexDirection: 'row',
  },
  pillarCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.lg,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 8px 20px -3px rgba(15, 23, 42, 0.08)',
    } : {}),
  },
  pillarIconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  pillarTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  pillarDesc: {
    fontSize: FontSize.xs,
    color: '#475569',
    lineHeight: 18,
  },

  // Formulario
  formSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.xl,
    maxWidth: 820,
    alignSelf: 'center',
    width: '100%',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.10)',
    } : {}),
  },
  formCardDesktop: {
    padding: Spacing.xxl,
  },
  formCardHeader: {
    marginBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: Spacing.lg,
  },
  formCardBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xs,
    marginBottom: 8,
  },
  formCardBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  formCardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 4,
  },
  formCardSubtitle: {
    fontSize: FontSize.sm,
    color: '#475569',
    lineHeight: 20,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: Spacing.md,
    borderRadius: Radius.xs,
    marginBottom: Spacing.lg,
  },
  errorBannerText: {
    flex: 1,
    color: '#DC2626',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },

  formGroupSection: {
    marginBottom: Spacing.xl,
    gap: 12,
  },
  formSectionLegend: {
    fontSize: FontSize.sm,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  twoColRow: {
    gap: 12,
  },
  twoColRowDesktop: {
    flexDirection: 'row',
  },
  inputField: {
    gap: 6,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#334155',
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: Radius.xs,
    paddingHorizontal: 12,
    fontSize: FontSize.sm,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    ...(Platform.OS === 'web' ? {
      outlineStyle: 'none' as any,
    } : {}),
  },
  textArea: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: 'top',
  },

  rubroPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  rubroPill: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.xs,
  },
  rubroPillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.primary,
  },
  rubroPillText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  rubroPillTextActive: {
    color: Colors.primary,
    fontWeight: '800',
  },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: Radius.xs,
    marginTop: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  privacyNote: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: Spacing.md,
    lineHeight: 16,
  },

  // Success State
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: Spacing.xxl,
    maxWidth: 700,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'center',
    textAlign: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },
  successIconWrap: {
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  successDesc: {
    fontSize: FontSize.sm,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  successSubDesc: {
    fontSize: FontSize.xs,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing.xl,
  },
  successActionsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.xs,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  whatsappActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16A34A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.xs,
  },
  whatsappActionBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
