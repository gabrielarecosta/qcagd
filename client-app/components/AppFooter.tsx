import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';
import MaterialCommunityIcons from './icons/MaterialCommunityIcons';
import { Colors } from '../constants/Colors';
import { FontSize, FontWeight } from '../constants/Typography';
import { Radius, Spacing } from '../constants/Spacing';
import { companySettingsService, CompanySettings } from '@shared/services/companySettingsService';
import { FaqsModal } from './legal/FaqsModal';
import { TermsModal } from './legal/TermsModal';
import { ArrepentimientoModal } from './legal/ArrepentimientoModal';

export function AppFooter() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [showFaqs, setShowFaqs] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showArrepentimiento, setShowArrepentimiento] = useState(false);

  useEffect(() => {
    companySettingsService.get().then(res => setCompanySettings(res)).catch(() => {});
  }, []);

  const handleOpenWhatsApp = () => {
    const wa = companySettings?.whatsapp || '5493511234567';
    const cleanWa = wa.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/${cleanWa}?text=Hola!%20Me%20contacto%20desde%20la%20App%20de%20Qu%C3%ADmica%20General%20Deheza.`);
  };

  return (
    <View style={[styles.footerContainer, isDesktop && styles.footerContainerDesktop]}>
      <View style={[styles.footerInner, isDesktop && styles.footerInnerDesktop]}>
        
        {/* Columna 1: Información de la Empresa */}
        <View style={[styles.col, isDesktop && styles.colDesktopBrand]}>
          <View style={styles.brandRow}>
            <View style={styles.logoBadge}>
              <MaterialCommunityIcons name="flask-outline" size={22} color="#ffffff" />
            </View>
            <Text style={styles.brandName}>Química General Deheza</Text>
          </View>
          <Text style={styles.brandDesc}>
            Venta minorista y mayorista de productos de limpieza, perfumería, desinfectantes y químicos profesionales.
          </Text>

          {companySettings?.direccion ? (
            <View style={styles.contactItem}>
              <MaterialCommunityIcons name="map-marker-outline" size={16} color="#94a3b8" />
              <Text style={styles.contactText}>{companySettings.direccion}</Text>
            </View>
          ) : null}

          {companySettings?.telefono ? (
            <View style={styles.contactItem}>
              <MaterialCommunityIcons name="phone-outline" size={16} color="#94a3b8" />
              <Text style={styles.contactText}>{companySettings.telefono}</Text>
            </View>
          ) : null}
        </View>

        {/* Columna 2: Enlaces Rápidos & Ayuda */}
        <View style={[styles.col, isDesktop && styles.colDesktopLinks]}>
          <Text style={styles.colTitle}>Centro de Ayuda</Text>
          <TouchableOpacity style={styles.linkRow} onPress={() => setShowFaqs(true)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="help-circle-outline" size={16} color={Colors.primary} />
            <Text style={styles.linkText}>Preguntas Frecuentes (FAQs)</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={() => setShowTerms(true)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="file-document-outline" size={16} color={Colors.primary} />
            <Text style={styles.linkText}>Términos y Condiciones</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkRow} onPress={handleOpenWhatsApp} activeOpacity={0.7}>
            <MaterialCommunityIcons name="whatsapp" size={16} color="#25D366" />
            <Text style={styles.linkText}>Atención al Cliente por WhatsApp</Text>
          </TouchableOpacity>
        </View>

        {/* Columna 3: Botón de Arrepentimiento (Defensa del Consumidor) */}
        <View style={[styles.col, isDesktop && styles.colDesktopArrepentimiento]}>
          <Text style={styles.colTitle}>Defensa del Consumidor</Text>
          <Text style={styles.arrepentimientoDesc}>
            Conforme al Art. 34 de la Ley 24.240, contás con 10 días corridos para revocar tu compra online:
          </Text>

          <TouchableOpacity
            style={styles.arrepentimientoBtn}
            onPress={() => setShowArrepentimiento(true)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="shield-alert-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.arrepentimientoBtnText}>Botón de Arrepentimiento</Text>
          </TouchableOpacity>
          <Text style={styles.arrepentimientoNote}>
            Resoluciones 424/2020 y 271/2020 · Secretaría de Comercio Interior
          </Text>
        </View>

      </View>

      {/* Barra de Copyright */}
      <View style={styles.bottomBar}>
        <Text style={styles.copyrightText}>
          © 2026 Química General Deheza. Todos los derechos reservados.
        </Text>
      </View>

      {/* Modales */}
      <FaqsModal visible={showFaqs} onClose={() => setShowFaqs(false)} />
      <TermsModal visible={showTerms} onClose={() => setShowTerms(false)} />
      <ArrepentimientoModal visible={showArrepentimiento} onClose={() => setShowArrepentimiento(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 36 : Spacing.xl,
  },
  footerContainerDesktop: {
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxl,
  },
  footerInner: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  footerInnerDesktop: {
    maxWidth: 1200,
    marginHorizontal: 'auto',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
  },
  col: {
    gap: 10,
  },
  colDesktopBrand: {
    flex: 1.3,
    paddingRight: 24,
  },
  colDesktopLinks: {
    flex: 1,
  },
  colDesktopArrepentimiento: {
    flex: 1.2,
    backgroundColor: '#1e293b',
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#334155',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: '#ffffff',
  },
  brandDesc: {
    fontSize: FontSize.xs,
    color: '#94a3b8',
    lineHeight: 18,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: FontSize.xs,
    color: '#cbd5e1',
  },
  colTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  linkText: {
    fontSize: FontSize.xs,
    color: '#e2e8f0',
    fontWeight: FontWeight.medium,
  },
  arrepentimientoDesc: {
    fontSize: 11.5,
    color: '#94a3b8',
    lineHeight: 16,
  },
  arrepentimientoBtn: {
    backgroundColor: '#dc2626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    marginTop: 4,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  arrepentimientoBtnText: {
    color: '#ffffff',
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  arrepentimientoNote: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
  },
  bottomBar: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  copyrightText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
});
