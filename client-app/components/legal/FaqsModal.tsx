import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import MaterialCommunityIcons from '../icons/MaterialCommunityIcons';
import { Colors } from '../../constants/Colors';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Radius, Spacing } from '../../constants/Spacing';

interface FaqItem {
  id: string;
  category: 'envios' | 'pagos' | 'stock' | 'devoluciones' | 'mayoristas';
  question: string;
  answer: string;
}

const FAQS_DATA: FaqItem[] = [
  {
    id: '1',
    category: 'envios',
    question: '¿Cómo funcionan los repartos y en qué horarios entregan?',
    answer:
      'Realizamos repartos programados en nuestra zona de cobertura en dos franjas horarias principales: Turno Mañana (09:00 a 13:00 hs) y Turno Tarde (14:00 a 18:00 hs). Podés seleccionar el día y la franja horaria que mejor te convenga al momento de confirmar tu pedido en el carrito.',
  },
  {
    id: '2',
    category: 'envios',
    question: '¿Puedo retirar mi pedido personalmente por el local?',
    answer:
      '¡Sí! Podés seleccionar la opción "Retiro en local / sucursal" durante el proceso de compra. Te avisaremos cuando tu pedido esté embalado y listo para que pases a retirarlo sin costo adicional.',
  },
  {
    id: '3',
    category: 'pagos',
    question: '¿Qué medios de pago están disponibles?',
    answer:
      'Aceptamos Transferencia Bancaria (con Alias/CBU directo), Mercado Pago (dinero en cuenta, tarjetas de débito o crédito), Efectivo contra entrega (al momento de recibir la mercadería) y Cuenta Corriente para clientes mayoristas autorizados.',
  },
  {
    id: '4',
    category: 'pagos',
    question: '¿Cómo informo un pago realizado por Transferencia Bancaria?',
    answer:
      'Al confirmar tu pedido con Transferencia Bancaria, la app te mostrará los datos de nuestra cuenta bancaria (Banco, CBU, Alias y CUIT) junto con un botón directo para enviar tu comprobante por WhatsApp. De este modo, nuestro equipo de finanzas verifica la acreditación al instante.',
  },
  {
    id: '5',
    category: 'stock',
    question: '¿Qué ocurre si un producto solicitado no tiene stock disponible?',
    answer:
      'En el carrito de compras podés elegir tu preferencia ante falta de stock: podés indicarnos si preferís que te llamemos por teléfono antes del despacho para consultar una alternativa, o si autorizás a nuestro equipo a seleccionar un producto similar de igual o superior calidad.',
  },
  {
    id: '6',
    category: 'mayoristas',
    question: '¿Tienen precios especiales para comercios, fábricas y revendedores?',
    answer:
      'Sí, contamos con un catálogo mayorista con precios diferenciales por volumen, súper ofertas en combos promocionales y bultos cerrados. Podés solicitar la habilitación de tu cuenta mayorista contactándote con nuestra administración.',
  },
  {
    id: '7',
    category: 'devoluciones',
    question: '¿Cómo funciona el Botón de Arrepentimiento y la solicitud de reembolso?',
    answer:
      'Conforme a la Ley 24.240 de Defensa del Consumidor, contás con 10 días corridos desde la recepción del pedido para revocar la compra. Podés presionar el "Botón de Arrepentimiento" ubicado en el pie de página para completar el formulario y gestionar la devolución o reintegro del dinero.',
  },
  {
    id: '8',
    category: 'stock',
    question: '¿Los productos químicos y de limpieza cuentan con especificaciones técnicas?',
    answer:
      'Todos nuestros productos cumplen con las normas de seguridad vigentes. En el catálogo podés consultar las presentaciones (litros, bidones, unidades) y recomendaciones de uso para cada línea de limpieza del hogar, automotor, piscinas e industrial.',
  },
];

interface FaqsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function FaqsModal({ visible, onClose }: FaqsModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedFaqId(prev => (prev === id ? null : id));
  };

  const filteredFaqs = FAQS_DATA.filter(faq => {
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={[styles.modalContainer, isDesktop && styles.modalContainerDesktop]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="help-circle-outline" size={24} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Preguntas Frecuentes</Text>
                <Text style={styles.headerSubtitle}>Respuestas rápidas sobre envíos, pagos y compras</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por palabra clave (ej: envíos, cbu, stock...)"
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Categories Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {[
              { id: 'all', label: 'Todas' },
              { id: 'envios', label: '🚚 Envíos y Horarios' },
              { id: 'pagos', label: '💳 Medios de Pago' },
              { id: 'stock', label: '📦 Stock y Productos' },
              { id: 'mayoristas', label: '🏢 Mayoristas' },
              { id: 'devoluciones', label: '🛡️ Devoluciones' },
            ].map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catPill, selectedCategory === cat.id && styles.catPillActive]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.8}
              >
                <Text style={[styles.catPillText, selectedCategory === cat.id && styles.catPillTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* FAQ List */}
          <ScrollView contentContainerStyle={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {filteredFaqs.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons name="text-box-search-outline" size={48} color="#cbd5e1" />
                <Text style={styles.emptyText}>No encontramos preguntas que coincidan con tu búsqueda.</Text>
              </View>
            ) : (
              filteredFaqs.map(faq => {
                const isExpanded = expandedFaqId === faq.id;
                return (
                  <View key={faq.id} style={[styles.faqCard, isExpanded && styles.faqCardExpanded]}>
                    <TouchableOpacity
                      style={styles.faqHeader}
                      onPress={() => toggleExpand(faq.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.faqQuestion, isExpanded && styles.faqQuestionExpanded]}>
                        {faq.question}
                      </Text>
                      <MaterialCommunityIcons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={22}
                        color={isExpanded ? Colors.primary : '#64748b'}
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.faqBody}>
                        <Text style={styles.faqAnswer}>{faq.answer}</Text>
                      </View>
                    )}
                  </View>
                );
              })
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
    maxHeight: '90%',
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
    maxWidth: 720,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  categoriesScroll: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catPillText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    color: '#64748b',
  },
  catPillTextActive: {
    color: '#ffffff',
    fontWeight: FontWeight.bold,
  },
  contentScroll: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: 10,
  },
  faqCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  faqCardExpanded: {
    borderColor: Colors.primary,
    backgroundColor: '#f8fafc',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  faqQuestion: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginRight: 10,
  },
  faqQuestionExpanded: {
    color: Colors.primary,
  },
  faqBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  faqAnswer: {
    fontSize: FontSize.sm,
    color: '#475569',
    lineHeight: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
