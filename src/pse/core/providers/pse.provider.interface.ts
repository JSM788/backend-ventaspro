export interface PseEmitResponse {
  success: boolean;
  viaEmision: 'NATIVO' | 'NUBEFACT' | 'OTRO';
  sunatStatus: 'ACEPTADO' | 'RECHAZADO' | 'EXCEPCION';
  message: string;
  xmlUrl?: string;
  cdrUrl?: string;
  pdfUrl?: string;
  errorCode?: string;
}

export interface IPseProvider {
  /**
   * Procesa la firma y emisión de un comprobante hacia la SUNAT o servicio de terceros.
   */
  emitir(comprobanteId: string): Promise<PseEmitResponse>;

  /**
   * Consulta el estado de un ticket/comprobante previamente enviado.
   */
  consultarEstado(comprobanteId: string, ticket?: string): Promise<PseEmitResponse>;
}
