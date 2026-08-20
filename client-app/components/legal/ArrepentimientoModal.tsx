import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  Linking,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';
import { useAuthStore } from '../../store/authStore';
import { refundService } from '@shared/services/refundService';
import { companySettingsService } from '@shared/services/companySettingsService';

interface ArrepentimientoModalProps {
  visible: boolean;
  onClose: () => void;
}

const MOTIVOS_REEMBOLSO = [
  'Me arrepentí de mi compra',
  'Compré mal',
  'Otro',
];

export function ArrepentimientoModal({ visible, onClose }: ArrepentimientoModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const clientData = useAuthStore(state => state.clientData);

  const [orderNumero, setOrderNumero] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS_REEMBOLSO[0]);
  const [otroMotivoTexto, setOtroMotivoTexto] = useState('');
  const [detalle, setDetalle] = useState('');
  const [cbuReintegro, setCbuReintegro] = useState('');
  const [aliasReintegro, setAliasReintegro] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [successTrackingId, setSuccessTrackingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      if (clientData) {
        setCustomerName(clientData.nombre || '');
        setCustomerPhone(clientData.telefono || '');
        setCustomerEmail(clientData.email || '');
      }
      setSuccessTrackingId(null);
      setErrorMessage(null);
      setOtroMotivoTexto('');

      companySettingsService.get().then(res => setCompanySettings(res)).catch(() => {});
    }
  }, [visible, clientData]);

  const handleSubmit = async () => {
    if (!orderNumero.trim()) {
      setErrorMessage('Por favor ingresá el número de pedido.');
      return;
    }
    if (!customerName.trim()) {
      setErrorMessage('Por favor ingresá tu nombre completo.');
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage('Por favor ingresá un teléfono o WhatsApp de contacto.');
      return;
    }
    if (motivo === 'Otro' && !otroMotivoTexto.trim()) {
      setErrorMessage('Por favor especificá cuál fue el motivo.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const motivoFinal = motivo === 'Otro' ? `Otro: ${otroMotivoTexto.trim()}` : motivo;

    try {
      const res = await refundService.create({
        orderNumero: orderNumero.trim(),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        motivo: motivoFinal,
        detalle: detalle.trim(),
        cbuReintegro: cbuReintegro.trim(),
        aliasReintegro: aliasReintegro.trim(),
      });

      if (res.success && res.id) {
        setSuccessTrackingId(res.id);
      } else {
        setErrorMessage(res.error || 'No se pudo registrar la solicitud. Intentá nuevamente.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error de conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotifyWhatsApp = () => {
    if (!successTrackingId) return;
    const motivoFinal = motivo === 'Otro' ? `Otro: ${otroMotivoTexto.trim()}` : motivo;
    const waText = encodeURIComponent(
      `*SOLICITUD DE ARREPENTIMIENTO / REEMBOLSO*\n` +
      `*Código de Trámite:* ${successTrackingId}\n` +
      `*N° de Pedido:* ${orderNumero}\n` +
      `*Cliente:* ${customerName}\n` +
      `*Teléfono:* ${customerPhone}\n` +
      `*Motivo:* ${motivoFinal}\n` +
      (detalle ? `*Detalle:* ${detalle}\n` : '') +
      (aliasReintegro || cbuReintegro ? `*Datos Reintegro:* CBU: ${cbuReintegro || '—'} / Alias: ${aliasReintegro || '—'}\n` : '') +
      `Solicito la revocación del pedido conforme a la Ley 24.240.`
    );
    const targetNumber = companySettings?.whatsapp_transferencias || companySettings?.whatsapp || '5493511234567';
    const cleanPhone = targetNumber.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${cleanPhone}?text=${waText}`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={[styles.modalContainer, isDesktop && styles.modalContainerDesktop]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={[styles.iconCircle, { backgroundColor: '#fee2e2' }]}>
                <MaterialCommunityIcons name="shield-alert-outline" size={24} color="#dc2626" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Botón de Arrepentimiento</Text>
                <Text style={styles.headerSubtitle}>Ley 24.240 de Defensa del Consumidor (Art. 34)</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {successTrackingId ? (
              /* Success State */
              <View style={styles.successBox}>
                <View style={styles.successBadgeIcon}>
                  <MaterialCommunityIcons name="check-decagram" size={48} color="#059669" />
                </View>
                <Text style={styles.successTitle}>¡Solicitud Registrada con Éxito!</Text>
                <Text style={styles.successText}>
                  Hemos recibido tu solicitud de revocación y reembolso para el pedido <strong>{orderNumero}</strong>.
                </Text>

                <View style={styles.trackingCard}>
                  <Text style={styles.trackingLabel}>CÓDIGO DE TRÁMITE:</Text>
                  <Text style={styles.trackingCode}>{successTrackingId}</Text>
                  <Text style={styles.trackingSubtext}>
                    Guardá este código para hacer el seguimiento. Nuestro equipo de atención se pondrá en contacto dentro de las 24 horas hábiles.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.notifyWaBtn}
                  onPress={handleNotifyWhatsApp}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="whatsapp" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.notifyWaBtnText}>Avisar a Administración por WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.doneBtnText}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Form State */
              <View style={{ gap: 14 }}>
                <View style={styles.legalBanner}>
                  <MaterialCommunityIcons name="information" size={20} color="#1d4ed8" style={{ marginTop: 2 }} />
                  <Text style={styles.legalBannerText}>
                    Tenés derecho a revocar la aceptación de tu compra dentro de los <strong>10 días corridos</strong> desde la recepción del producto. El reintegro o cambio se gestionará a la brevedad.
                  </Text>
                </View>

                {errorMessage && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
                  </View>
                )}

                {/* Form Fields */}
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Número de Pedido *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: #PED-00042 o PED-1234"
                    value={orderNumero}
                    onChangeText={setOrderNumero}
                  />
                </View>

                <View style={styles.row}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Nombre y Apellido *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Tu nombre completo"
                      value={customerName}
                      onChangeText={setCustomerName}
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.label}>Teléfono / WhatsApp *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ej: 3511234567"
                      keyboardType="phone-pad"
                      value={customerPhone}
                      onChangeText={setCustomerPhone}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Correo Electrónico (Opcional)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ejemplo@correo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={customerEmail}
                    onChangeText={setCustomerEmail}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Motivo de la revocación o reembolso *</Text>
                  <View style={styles.motivosContainer}>
                    {MOTIVOS_REEMBOLSO.map(m => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.motivoChip, motivo === m && styles.motivoChipSelected]}
                        onPress={() => setMotivo(m)}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name={motivo === m ? 'radiobox-marked' : 'radiobox-blank'}
                          size={16}
                          color={motivo === m ? Colors.primary : '#94a3b8'}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.motivoText, motivo === m && styles.motivoTextSelected]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Cuadro de texto desplegable exclusivo para cuando elija 'Otro' */}
                {motivo === 'Otro' && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Especificá el motivo *</Text>
                    <TextInput
                      style={[styles.input, { borderColor: Colors.primary, backgroundColor: '#ffffff' }]}
                      placeholder="Escribí aquí cuál fue el motivo de tu solicitud..."
                      value={otroMotivoTexto}
                      onChangeText={setOtroMotivoTexto}
                      autoFocus
                    />
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Explicación o detalle adicional (Opcional)</Text>
                  <TextInput
                    style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                    placeholder="Contanos brevemente qué ocurrió para ayudarte más rápido..."
                    multiline
                    value={detalle}
                    onChangeText={setDetalle}
                  />
                </View>

                {/* Bank Account for refund */}
                <View style={styles.bankRefundSection}>
                  <Text style={styles.bankRefundTitle}>🏦 Datos bancarios para reintegro (Si abonaste por transferencia):</Text>
                  <View style={styles.row}>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Alias CBU/CVU</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: MI.ALIAS.BANCO"
                        value={aliasReintegro}
                        onChangeText={setAliasReintegro}
                      />
                    </View>
                    <View style={[styles.formGroup, { flex: 1 }]}>
                      <Text style={styles.label}>CBU / CVU (22 dígitos)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="00000031000..."
                        keyboardType="numeric"
                        value={cbuReintegro}
                        onChangeText={setCbuReintegro}
                      />
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, isLoading && { opacity: 0.7 }]}
                  onPress={handleSubmit}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="send" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                      <Text style={styles.submitBtnText}>Enviar Solicitud de Arrepentimiento</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
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
  },
  modalContainer: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#ffffff',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalContainerDesktop: {
    maxWidth: 680,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radius.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  contentScroll: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  legalBanner: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  legalBannerText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: '#1e3a8a',
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: '#dc2626',
    fontWeight: FontWeight.medium,
  },
  formGroup: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  motivosContainer: {
    gap: 6,
  },
  motivoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  motivoChipSelected: {
    backgroundColor: '#eff6ff',
    borderColor: Colors.primary,
  },
  motivoText: {
    fontSize: FontSize.xs,
    color: '#475569',
    flex: 1,
  },
  motivoTextSelected: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  bankRefundSection: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: Spacing.md,
    borderRadius: Radius.md,
    gap: 10,
  },
  bankRefundTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: '#334155',
  },
  submitBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 14,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  successBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 14,
  },
  successBadgeIcon: {
    marginBottom: 4,
  },
  successTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: '#065f46',
    textAlign: 'center',
  },
  successText: {
    fontSize: FontSize.sm,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  trackingCard: {
    width: '100%',
    backgroundColor: '#ecfdf5',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 6,
    marginVertical: 6,
  },
  trackingLabel: {
    fontSize: 11,
    fontWeight: FontWeight.bold,
    color: '#065f46',
    letterSpacing: 1,
  },
  trackingCode: {
    fontSize: 24,
    fontWeight: FontWeight.bold,
    color: '#047857',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  trackingSubtext: {
    fontSize: 12,
    color: '#065f46',
    textAlign: 'center',
  },
  notifyWaBtn: {
    width: '100%',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyWaBtnText: {
    color: '#ffffff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  doneBtn: {
    width: '100%',
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#475569',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
