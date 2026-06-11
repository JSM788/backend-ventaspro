import { HttpException, HttpStatus } from '@nestjs/common';

export const ErrorCodes = {
  // Errores de Autenticación
  UNAUTHORIZED: 'ERR_UNAUTHORIZED',
  FORBIDDEN: 'ERR_FORBIDDEN',
  
  // Errores de Negocio (Generales)
  VALIDATION_FAILED: 'ERR_VALIDATION_FAILED',
  ENTITY_NOT_FOUND: 'ERR_ENTITY_NOT_FOUND',
  DUPLICATE_ENTITY: 'ERR_DUPLICATE_ENTITY',
  
  // Errores Específicos de Facturación/Caja
  CAJA_CERRADA: 'ERR_CAJA_CERRADA',
  STOCK_INSUFICIENTE: 'ERR_STOCK_INSUFICIENTE',
  DOCUMENTO_INVALIDO: 'ERR_DOCUMENTO_INVALIDO',
  COMPROBANTE_YA_PAGADO: 'ERR_COMPROBANTE_YA_PAGADO',
  
  // Errores de Integración (SUNAT/Nubefact)
  SUNAT_TIMEOUT: 'ERR_SUNAT_TIMEOUT',
  SUNAT_RECHAZADO: 'ERR_SUNAT_RECHAZADO',
  PROVEEDOR_CAIDO: 'ERR_PROVEEDOR_CAIDO',
  
  // Base de datos / Interno
  INTERNAL_ERROR: 'ERR_INTERNAL',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export class BusinessException extends HttpException {
  constructor(errorCode: ErrorCode, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ errorCode, message }, status);
  }
}
