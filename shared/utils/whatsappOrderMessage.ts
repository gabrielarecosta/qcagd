import { formatPrice } from './formatCurrency';

export interface WhatsAppOrderItem {
  name: string;
  presentation?: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface WhatsAppOrderMessageParams {
  orderNum: string;
  customerName?: string;
  customerPhone?: string;
  items: WhatsAppOrderItem[];
  total: number;
  deliveryMethod?: string;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  address?: string;
  outOfStockPreference?: string;
  observaciones?: string;
  paymentMethod?: string;
  isTransferReceipt?: boolean;
}

/**
 * Genera el mensaje estructurado automático para WhatsApp con número de pedido y desglose completo de productos
 */
export function buildWhatsAppOrderMessage({
  orderNum,
  customerName,
  customerPhone,
  items,
  total,
  deliveryMethod = 'reparto',
  deliveryDate,
  deliveryTimeSlot,
  address,
  outOfStockPreference = 'llamar',
  observaciones,
  paymentMethod = 'transferencia',
  isTransferReceipt = false,
}: WhatsAppOrderMessageParams): string {
  const header = isTransferReceipt
    ? `*COMPROBANTE DE PAGO — QUÍMICA GENERAL DEHEZA*`
    : `*NUEVO PEDIDO — QUÍMICA GENERAL DEHEZA*`;

  const deliveryLabel =
    deliveryMethod === 'retiro'
      ? '🏪 Retiro en local / sucursal'
      : deliveryMethod === 'whatsapp'
      ? '💬 Coordinar por WhatsApp'
      : '🚚 Envío por reparto a domicilio';

  const stockPrefText =
    outOfStockPreference === 'reemplazar'
      ? '🔄 Elegir artículo similar'
      : '📞 Llamarme para consultar';

  const paymentLabel =
    paymentMethod === 'transferencia'
      ? '🏦 Transferencia Bancaria'
      : paymentMethod === 'efectivo'
      ? '💵 Efectivo / Contra entrega'
      : paymentMethod === 'mercadopago'
      ? '💳 Mercado Pago'
      : paymentMethod === 'cuenta_corriente'
      ? '📋 Cuenta Corriente'
      : '🤝 Pago a acordar';

  let lines: string[] = [
    header,
    '',
    `*N° de Pedido:* #${orderNum}`,
  ];

  if (customerName) {
    lines.push(`*Cliente:* ${customerName}`);
  }
  if (customerPhone) {
    lines.push(`*Teléfono:* ${customerPhone}`);
  }

  lines.push(`*Entrega:* ${deliveryLabel}`);

  if (address && deliveryMethod === 'reparto') {
    lines.push(`*Dirección:* ${address}`);
  }

  if (deliveryDate && deliveryMethod === 'reparto') {
    lines.push(`*Fecha estimada:* ${deliveryDate}${deliveryTimeSlot ? ` (${deliveryTimeSlot})` : ''}`);
  }

  lines.push(`*Forma de Pago:* ${paymentLabel}`);
  lines.push(`*Ante falta de stock:* ${stockPrefText}`);

  lines.push('');
  lines.push(`*DETALLE DEL PEDIDO (${items.length} productos):*`);

  items.forEach((it, idx) => {
    const pres = it.presentation ? ` (${it.presentation})` : '';
    lines.push(`• *${it.qty}x* ${it.name}${pres}`);
    lines.push(`   Precio: ${formatPrice(it.unitPrice)} | Subtotal: *${formatPrice(it.subtotal)}*`);
  });

  lines.push('');
  lines.push(`*TOTAL A PAGAR:* ${formatPrice(total)}`);

  if (observaciones && observaciones.trim()) {
    lines.push('');
    lines.push(`*Observaciones:* ${observaciones.trim()}`);
  }

  if (isTransferReceipt) {
    lines.push('');
    lines.push(`📎 *Adjunto a continuación la captura del comprobante bancario.*`);
  }

  return lines.join('\n');
}
