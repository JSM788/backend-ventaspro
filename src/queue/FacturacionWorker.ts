import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { db } from '../infrastructure/database';
import { FacturadorNativoProvider } from '../infrastructure/providers/FacturadorNativoProvider';
import { NubefactProvider } from '../infrastructure/providers/NubefactProvider';

const connection = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

export const FacturacionWorker = new Worker(
    'cola-facturacion',
    async (job: Job) => {
        const { comprobanteId, tieneCertificado } = job.data;

        // 1. Bloqueo de seguridad: Cambiar estado a PROCESANDO para evitar duplicación masiva
        const comprobante = await db.comprobante.update({
            where: { id: comprobanteId },
            data: { estadoSunat: 'PROCESANDO' }
        });

        // ESCENARIO A: Cliente no cuenta con Certificado Digital propio -> Va directo a Nubefact
        if (!tieneCertificado) {
            console.log(`[ID: ${comprobante.transaccionId}] Sin certificado configurado. Direccionando directo a Nubefact.`);
            return await procesarPorNubefact(comprobanteId);
        }

        // ESCENARIO B: Flujo Principal Nativo (Costo Cero)
        try {
            console.log(`[ID: ${comprobante.transaccionId}] Intentando procesamiento nativo a SUNAT...`);
            const resultadoNativo = await FacturadorNativoProvider.enviar(comprobanteId);
            
            // Éxito nativo total
            await db.comprobante.update({
                where: { id: comprobanteId },
                data: {
                    estadoSunat: 'ACEPTADO',
                    viaEmision: 'NATIVO',
                    sunatResponseMsg: 'Aceptado por SUNAT de manera directa.'
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
                // Es un error de validación regulatoria (XML mal armado, inconsistencia de datos, cambio de normas)
                await db.comprobante.update({
                    where: { id: comprobanteId },
                    data: {
                        estadoSunat: 'RECHAZADO_POR_CORREGIR',
                        viaEmision: 'NATIVO',
                        sunatCodeError: error.sunatCode || 'UNKNOWN',
                        sunatResponseMsg: error.message
                    }
                });
                
                // Sistema de Alerta Temprana al desarrollador
                await notificarDesarrollador(comprobante.transaccionId, error.message);
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
                sunatResponseMsg: `Procesado exitosamente mediante contingencia Nubefact. ID Nubefact: ${resultadoNube.id}`
            }
        });
        console.log(`[ID: ${comprobanteId}] Comprobante procesado exitosamente vía Nubefact.`);
    } catch (errorNube: any) {
        console.error(`[CRÍTICO] Fallaron ambos canales de facturación para el ID ${comprobanteId}: ${errorNube.message}`);
        
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
