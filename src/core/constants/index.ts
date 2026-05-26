export const TIPOS_COMPROBANTE = {
  FACTURA: '01',
  BOLETA: '03',
  NOTA_CREDITO: '07',
  NOTA_DEBITO: '08',
  NOTA_VENTA: 'NV',
} as const;

export const ESTADOS_SUNAT = {
  ACEPTADO: 'ACEPTADO',
  RECHAZADO: 'RECHAZADO',
  PENDIENTE: 'PENDIENTE',
  ANULADO: 'ANULADO',
  NO_APLICA: 'NO_APLICA',
} as const;

export const CONDICIONES_PAGO = {
  CONTADO: 'contado',
  CREDITO: 'credito',
} as const;

export const ESTADOS_PAGO = {
  PAGADO: 'PAGADO',
  PENDIENTE: 'PENDIENTE',
} as const;
