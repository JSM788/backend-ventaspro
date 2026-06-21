import { Injectable, Logger } from '@nestjs/common';
import { IPseProvider, PseEmitResponse } from './pse.provider.interface';
import { db } from '../../../infrastructure/database'; // TODO: Migrar a PrismaService
import { InvoiceBuilder } from '../xml/builders/InvoiceBuilder';
import { XmlSigner } from '../signer/XmlSigner';
import { SunatSoapClient } from '../sunat/soap/SunatSoapClient';
import * as forge from 'node-forge';

@Injectable()
export class SunatNativeProvider implements IPseProvider {
  private readonly logger = new Logger(SunatNativeProvider.name);

  async emitir(comprobanteId: string): Promise<PseEmitResponse> {
    const comprobante = await db.comprobante.findUnique({
      where: { id: comprobanteId },
      include: { empresa: true, cliente: true, detalles: true, cuotas: true }
    });

    if (!comprobante) {
      return { success: false, viaEmision: 'NATIVO', sunatStatus: 'RECHAZADO', message: 'Comprobante no encontrado' };
    }

    if (comprobante.tipo === 'NV') {
      return { success: true, viaEmision: 'NATIVO', sunatStatus: 'ACEPTADO', message: 'Nota de Venta interna generada.' };
    }

    const config = await db.configuracionSistema.findUnique({ where: { id: "GLOBAL" } });
    const tieneCertificado = !!config?.certificadoBase64;
    if (!tieneCertificado) {
      return { success: true, viaEmision: 'NATIVO', sunatStatus: 'ACEPTADO', message: 'Simulado Aceptado (Sin Certificado / Modo MVP).' };
    }

    try {
      this.logger.log(`[ID: ${comprobante.transaccionId}] Intentando procesamiento nativo a SUNAT...`);
      
      const xmlSinFirma = InvoiceBuilder.build(comprobante);
      const { privateKeyPem, certBase64 } = this.extractCert(
        config!.certificadoBase64!, 
        config!.certificadoPassword || ''
      );
      
      const { signedXml } = XmlSigner.sign(xmlSinFirma, privateKeyPem, certBase64);
      const soapResult = await SunatSoapClient.sendBill(comprobante.empresa!, config!, comprobante, signedXml);

      return {
        success: true,
        viaEmision: 'NATIVO',
        sunatStatus: 'ACEPTADO',
        message: 'Aceptado por SUNAT de manera directa.',
        // TODO: Subir XML y CDR a Storage S3/Local y retornar URLs
        xmlUrl: soapResult.xmlFileName ? `/api/comprobantes/download/xml/${soapResult.xmlFileName}` : undefined,
        cdrUrl: soapResult.zipFileName ? `/api/comprobantes/download/cdr/${soapResult.zipFileName}` : undefined
      };
    } catch (error: any) {
      this.logger.error(`[ID: ${comprobante.transaccionId}] Error en canal Nativo: ${error.message}`);
      
      if (error.isNetworkError || error.code === 'ECONNRESET' || error.code === 'TIMEOUT') {
        return { success: false, viaEmision: 'NATIVO', sunatStatus: 'EXCEPCION', errorCode: 'ERR_SUNAT_TIMEOUT', message: 'Timeout SUNAT.' };
      }
      
      return { 
        success: false, 
        viaEmision: 'NATIVO', 
        sunatStatus: 'RECHAZADO', 
        errorCode: error.sunatCode || 'ERR_SUNAT_RECHAZADO',
        message: (error.message || '').substring(0, 2000) 
      };
    }
  }

  async consultarEstado(comprobanteId: string, ticket?: string): Promise<PseEmitResponse> {
    return { success: false, viaEmision: 'NATIVO', sunatStatus: 'EXCEPCION', message: 'No implementado' };
  }

  private extractCert(base64: string, password: string) {
    const p12Der = forge.util.decode64(base64);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);
    let privateKeyPem = '', certPem = '';
    
    for (const safeContent of p12.safeContents) {
      for (const safeBag of safeContent.safeBags) {
        if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag && safeBag.key) {
          privateKeyPem = forge.pki.privateKeyToPem(safeBag.key);
        } else if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
          certPem = forge.pki.certificateToPem(safeBag.cert);
        }
      }
    }
    const certBase64 = certPem.replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/\n/g, '').trim();
    return { privateKeyPem, certBase64 };
  }
}
