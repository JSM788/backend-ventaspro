import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { db } from '../../../infrastructure/database';
import { PdfGenerator } from '../../core/pdf/PdfGenerator';
import { InvoiceBuilder } from '../../core/xml/builders/InvoiceBuilder';
import { XmlSigner } from '../../core/signer/XmlSigner';
import { SunatSoapClient } from '../../core/sunat/soap/SunatSoapClient';
import * as path from 'path';
import { NubefactProvider } from '../../../infrastructure/providers/NubefactProvider';

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null
});

export const FacturacionWorker = new Worker(
    'cola-facturacion',
    async (job: Job) => {
        const { comprobanteId } = job.data;

        const comprobante = await db.comprobante.findUnique({
            where: { id: comprobanteId },
            include: { empresa: true, cliente: true, detalles: true }
        });

        if (!comprobante) return;

        // Bypassear lógica SUNAT si es una Nota de Venta
        if (comprobante.tipo === 'NV') {
            console.log(`[ID: ${comprobante.transaccionId}] Procesando Nota de Venta interna. Generando PDF...`);
            const pdfPath = await PdfGenerator.generarComprobante(comprobante as any);

            await db.comprobante.update({
                where: { id: comprobanteId },
                data: {
                    estadoSunat: 'ACEPTADO',
                    sunatResponseMsg: 'Nota de Venta interna generada correctamente.',
                    pdfPath: pdfPath
                }
            });
            return;
        }

        // 1. Bloqueo de seguridad: Cambiar estado a PROCESANDO para evitar duplicación masiva
        await db.comprobante.update({
            where: { id: comprobanteId },
            data: { estadoSunat: 'PROCESANDO' }
        });

        const tieneCertificado = !!comprobante.empresa?.certificadoBase64;

        // ESCENARIO A: Cliente no cuenta con Certificado Digital propio -> Va directo a Nubefact
        if (!tieneCertificado) {
            console.log(`[ID: ${comprobante.transaccionId}] Sin certificado configurado. Direccionando directo a Nubefact.`);
            return await procesarPorNubefact(comprobanteId);
        }

        // ESCENARIO B: Flujo Principal Nativo (Costo Cero)
        try {
            console.log(`[ID: ${comprobante.transaccionId}] Intentando procesamiento nativo a SUNAT...`);
            
            // 1. Construir XML
            const xmlSinFirma = InvoiceBuilder.build(comprobante);

            // 2. Preparar certificados
            const forge = require('node-forge');
            const p12Der = forge.util.decode64(comprobante.empresa!.certificadoBase64);
            const p12Asn1 = forge.asn1.fromDer(p12Der);
            const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, comprobante.empresa!.certificadoPassword || '');
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

            // 3. Firmar XML
            const { signedXml, signatureHash } = XmlSigner.sign(xmlSinFirma, privateKeyPem, certBase64);

            // 4. Enviar a SUNAT (SOAP)
            const soapResult = await SunatSoapClient.sendBill(comprobante.empresa!, comprobante, signedXml);

            // 5. Generar PDF
            const pdfPathLocal = await PdfGenerator.generarComprobante(comprobante, signatureHash);
            
            const pdfFileName = path.basename(pdfPathLocal);
            const xmlFileName = path.basename(soapResult.xmlPath);
            const cdrFileName = soapResult.cdrPath ? path.basename(soapResult.cdrPath) : null;

            // Éxito nativo total
            await db.comprobante.update({
                where: { id: comprobanteId },
                data: {
                    estadoSunat: 'ACEPTADO',
                    viaEmision: 'NATIVO',
                    sunatResponseMsg: 'Aceptado por SUNAT de manera directa.',
                    pdfPath: `/api/comprobantes/download/pdf/${pdfFileName}`,
                    xmlPath: `/api/comprobantes/download/xml/${xmlFileName}`
                }
            });
            console.log(`[ID: ${comprobante.transaccionId}] Comprobante ACEPTADO nativamente.`);

        } catch (error: any) {
            console.error(`[ID: ${comprobante.transaccionId}] Error en canal Nativo: ${error.message}`);

            // Evaluar si es un error de conectividad de la SUNAT (Timeout, caída, HTTP 500)
            if (error.isNetworkError || error.code === 'ECONNRESET' || error.code === 'TIMEOUT') {
                console.warn(`[CONMUTACIÓN] Servidor SUNAT no disponible de forma nativa. Activando Switch de contingencia con Nubefact...`);
                return await procesarPorNubefact(comprobanteId);
            } else {
                const msgTruncado = (error.message || '').substring(0, 2000);
                await db.comprobante.update({
                    where: { id: comprobanteId },
                    data: {
                        estadoSunat: 'RECHAZADO',
                        viaEmision: 'NATIVO',
                        sunatCodeError: (error.sunatCode || 'UNKNOWN').substring(0, 10),
                        sunatResponseMsg: msgTruncado
                    }
                });
                
                // Sistema de Alerta Temprana al desarrollador
                await notificarDesarrollador(comprobante.transaccionId, msgTruncado);
            }
        }
    },
    { connection }
);

async function procesarPorNubefact(comprobanteId: string) {
    try {
        const resultadoNube = await NubefactProvider.enviar(comprobanteId);
        
        await db.comprobante.update({
            where: { id: comprobanteId },
            data: {
                estadoSunat: 'ACEPTADO',
                viaEmision: 'NUBEFACT',
                sunatResponseMsg: `Procesado exitosamente mediante contingencia Nubefact. ID Nubefact: ${resultadoNube.id}`,
                pdfPath: resultadoNube.enlace_del_pdf,
                xmlPath: resultadoNube.enlace_del_xml,
            }
        });
        console.log(`[ID: ${comprobanteId}] Comprobante procesado exitosamente vía Nubefact.`);
    } catch (errorNube: any) {
        console.error(`[CRÍTICO] Fallaron ambos canales de facturación para el ID ${comprobanteId}: ${errorNube.message}`);
        
        if (errorNube.isValidationError) {
            await db.comprobante.update({
                where: { id: comprobanteId },
                data: { 
                    estadoSunat: 'RECHAZADO',
                    sunatResponseMsg: errorNube.message
                }
            });
            return; // No relanzamos para evitar reintentos infinitos
        }

        await db.comprobante.update({
            where: { id: comprobanteId },
            data: { estadoSunat: 'FALLIDO_REINTENTANDO' }
        });
        
        throw errorNube; // Forzar el reintento automático de la cola
    }
}

async function notificarDesarrollador(txId: string, errorMsg: string) {
    console.log(`[ALERT] Webhook/Slack: Enviar notificación a desarrollo para parche de emergencia en TX: ${txId}. Motivo: ${errorMsg}`);
}
