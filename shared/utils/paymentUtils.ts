export function calculateChange(total: number, paidAmount?: number) {
  if (!paidAmount || paidAmount < total) {
    return {
      total,
      paidAmount,
      change: 0,
      isValid: false,
    };
  }
  return {
    total,
    paidAmount,
    change: paidAmount - total,
    isValid: true,
  };
}

export function getPaymentMethodLabel(method: string): string {
  switch (method) {
    case 'mercado_pago': return 'Mercado Pago';
    case 'efectivo': return 'Efectivo';
    case 'transferencia': return 'Transferencia Bancaria';
    case 'cuenta_corriente': return 'Cuenta Corriente';
    default: return 'A convenir';
  }
}

export function getPaymentStatusLabel(status: string): string {
  switch (status) {
    case 'pendiente': return 'Pendiente';
    case 'aprobado': return 'Aprobado';
    case 'rechazado': return 'Rechazado';
    case 'efectivo_al_entregar': return 'Efectivo al recibir';
    case 'transferencia_pendiente': return 'Transferencia Pendiente';
    case 'transferencia_confirmada': return 'Transferencia Confirmada';
    case 'cuenta_corriente': return 'A CC';
    case 'pagado': return 'Pagado';
    default: return 'Desconocido';
  }
}
