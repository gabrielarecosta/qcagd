import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';

interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function TermsModal({ visible, onClose }: TermsModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={[styles.modalContainer, isDesktop && styles.modalContainerDesktop]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="file-document-outline" size={24} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Términos y Condiciones</Text>
                <Text style={styles.headerSubtitle}>Condiciones de compra, entrega y uso de la plataforma</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Legal Text Scroll */}
          <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={true}>
            <Text style={styles.lastUpdated}>Última actualización: Agosto de 2026 — General Deheza, Córdoba, Argentina</Text>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Titularidad y Objeto del Servicio</Text>
              <Text style={styles.paragraph}>
                El presente sitio y aplicación móvil son operados por <strong>Química General Deheza</strong>, dedicada a la comercialización y distribución de artículos de limpieza del hogar, perfumería, productos químicos profesionales, desinfectantes, descartables y químicos para piscinas e industria.
              </Text>
              <Text style={styles.paragraph}>
                La utilización de esta plataforma implica la aceptación plena e incondicional de los presentes Términos y Condiciones por parte de cualquier usuario o cliente registrado.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Precios, Ofertas y Catálogo</Text>
              <Text style={styles.paragraph}>
                • Todos los precios exhibidos están expresados en Pesos Argentinos ($ ARS) e incluyen los impuestos aplicables, salvo indicación expresa para cuentas mayoristas.
              </Text>
              <Text style={styles.paragraph}>
                • Las promociones, súper ofertas y descuentos por volumen están sujetos a disponibilidad de stock y pueden ser actualizadas o modificadas periódicamente por la administración.
              </Text>
              <Text style={styles.paragraph}>
                • En caso de discrepancia involuntaria o error tipográfico en un precio publicado, nos pondremos en contacto con el cliente antes del despacho para reconfirmar la orden.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. Métodos de Pago y Facturación</Text>
              <Text style={styles.paragraph}>
                Los pedidos podrán abonarse mediante los medios autorizados y habilitados en el checkout:
              </Text>
              <Text style={styles.bulletItem}>
                a) <strong>Transferencia Bancaria:</strong> El cliente debe transferir el importe exacto al CBU/Alias informado por la empresa y enviar el comprobante correspondiente por WhatsApp o canal oficial para su verificación.
              </Text>
              <Text style={styles.bulletItem}>
                b) <strong>Mercado Pago:</strong> Procesamiento digital seguro mediante pasarela electrónica.
              </Text>
              <Text style={styles.bulletItem}>
                c) <strong>Efectivo contra entrega:</strong> El pago se efectúa al repartidor o personal de entrega en el momento de recibir la mercadería.
              </Text>
              <Text style={styles.bulletItem}>
                d) <strong>Cuenta Corriente:</strong> Exclusivo para clientes mayoristas o sucursales con crédito comercial previamente aprobado.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>4. Modalidades y Condiciones de Entrega</Text>
              <Text style={styles.paragraph}>
                • <strong>Reparto a Domicilio:</strong> Las entregas se realizan dentro de las zonas de cobertura geográfica y en los días/franjas horarias seleccionadas al comprar.
              </Text>
              <Text style={styles.paragraph}>
                • <strong>Recepción Conforme:</strong> Al recibir el pedido, el cliente debe verificar la integridad de los envases y la concordancia de los bultos con el remito de entrega.
              </Text>
              <Text style={styles.paragraph}>
                • <strong>Preferencia ante Falta de Stock:</strong> Si al momento de armar el pedido algún artículo se encontrara agotado, se respetará la preferencia seleccionada por el cliente (llamada telefónica para coordinar sustituto o reemplazo por artículo similar).
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>5. Derecho de Revocación y Botón de Arrepentimiento</Text>
              <Text style={styles.paragraph}>
                De conformidad con el <strong>Artículo 34 de la Ley N° 24.240 de Defensa del Consumidor</strong> y las Resoluciones 424/2020 y 271/2020 de la Secretaría de Comercio Interior:
              </Text>
              <Text style={styles.paragraph}>
                • El consumidor tiene derecho a revocar la aceptación de la compra dentro del plazo de <strong>diez (10) días corridos</strong> contados a partir de la fecha de entrega del producto.
              </Text>
              <Text style={styles.paragraph}>
                • Para ejercer este derecho, el cliente podrá utilizar el <strong>"Botón de Arrepentimiento"</strong> disponible en el pie de página de la aplicación o sitio web, completando el formulario de solicitud de reembolso.
              </Text>
              <Text style={styles.paragraph}>
                • El reintegro de dinero se efectuará por el mismo medio de pago utilizado o mediante transferencia a la cuenta bancaria informada por el cliente, una vez recepcionado o coordinado el retiro de los productos en su embalaje original e inalterado.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>6. Manejo Seguro de Sustancias Químicas</Text>
              <Text style={styles.paragraph}>
                • Los productos comercializados por Química General Deheza deben manipularse siguiendo estrictamente las instrucciones del rótulo, manteniéndolos fuera del alcance de niños y mascotas.
              </Text>
              <Text style={styles.paragraph}>
                • La empresa no se responsabiliza por el uso indebido, dilución inapropiada o mezcla no autorizada de sustancias químicas una vez entregadas en destino.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>7. Privacidad y Protección de Datos (Ley 25.326)</Text>
              <Text style={styles.paragraph}>
                Los datos personales recolectados (nombre, teléfono, domicilio, email) son utilizados exclusivamente para la gestión de pedidos, facturación y logística de entrega. No serán cedidos a terceros sin consentimiento previo.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>8. Legislación Aplicable y Jurisdicción</Text>
              <Text style={styles.paragraph}>
                Los presentes términos se rigen por las leyes de la República Argentina. Ante cualquier controversia, las partes se someten a la competencia de los tribunales ordinarios de la Provincia de Córdoba.
              </Text>
            </View>
          </ScrollView>

          {/* Footer Close */}
          <View style={styles.footerBar}>
            <TouchableOpacity style={styles.acceptBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.acceptBtnText}>Entendido y Acepto</Text>
            </TouchableOpacity>
          </View>
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
    maxWidth: 760,
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
    backgroundColor: '#eff6ff',
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
    gap: 16,
  },
  lastUpdated: {
    fontSize: 11.5,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: Radius.md,
    gap: 6,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  paragraph: {
    fontSize: FontSize.sm,
    color: '#334155',
    lineHeight: 20,
  },
  bulletItem: {
    fontSize: FontSize.sm,
    color: '#334155',
    lineHeight: 20,
    paddingLeft: 8,
    marginVertical: 2,
  },
  footerBar: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    color: '#ffffff',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});
