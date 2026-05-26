import { db } from '../database';

export class NubefactProvider {
    /**
     * Motor híbrido de contingencia.
     * Envía un JSON estructurado a la API de Nubefact.
     */
    static async enviar(comprobanteId: string) {
        console.log(`[Nubefact] Enviando payload a API de contingencia Nubefact para ID ${comprobanteId}...`);
        
        // 1. Obtener la data completa desde la base de datos
        const comprobante = await db.comprobante.findUnique({
            where: { id: comprobanteId },
            include: {
                cliente: true,
                detalles: true
            }
        });

        if (!comprobante) {
            throw new Error(`Comprobante ${comprobanteId} no encontrado`);
        }

        // 2. Mapear al formato de Nubefact API v1
        const esFactura = comprobante.tipo === '01' || comprobante.tipo === 'factura';
        const tipoComprobante = esFactura ? 1 : 2; // 1: Factura, 2: Boleta
        const tipoDocumentoCliente = esFactura ? 6 : 1; // 6: RUC, 1: DNI

        const payload = {
            operacion: "generar_comprobante",
            tipo_de_comprobante: tipoComprobante,
            serie: comprobante.serie,
            numero: comprobante.correlativo,
            sunat_transaction: 1, // 1: VENTA INTERNA
            cliente_tipo_de_documento: tipoDocumentoCliente,
            cliente_numero_de_documento: comprobante.cliente.ruc,
            cliente_denominacion: comprobante.cliente.razonSocial,
            cliente_direccion: comprobante.cliente.direccion || "-",
            cliente_email: comprobante.cliente.email || "",
            cliente_email_1: "",
            cliente_email_2: "",
            fecha_de_emision: comprobante.fechaEmision.toISOString().split('T')[0],
            fecha_de_vencimiento: comprobante.fechaEmision.toISOString().split('T')[0], // Mismo día por ahora
            moneda: comprobante.moneda === "PEN" ? 1 : 2, // 1: Soles, 2: Dólares
            tipo_de_cambio: "",
            porcentaje_de_igv: 18.00,
            descuento_global: "",
            total_descuento: "",
            total_anticipo: "",
            total_gravada: Number(comprobante.operacionGravada),
            total_inafecta: "",
            total_exonerada: "",
            total_igv: Number(comprobante.igv),
            total_gratuita: "",
            total_otros_cargos: "",
            total: Number(comprobante.total),
            percepcion_tipo: "",
            percepcion_base_imponible: "",
            total_percepcion: "",
            total_incluido_percepcion: "",
            detraccion: "false",
            observaciones: "",
            documento_que_se_modifica_tipo: "",
            documento_que_se_modifica_serie: "",
            documento_que_se_modifica_numero: "",
            tipo_de_nota_de_credito: "",
            tipo_de_nota_de_debito: "",
            enviar_automaticamente_a_la_sunat: "true",
            enviar_automaticamente_al_cliente: "false",
            codigo_unico: "",
            condiciones_de_pago: "",
            medio_de_pago: "",
            placa_vehiculo: "",
            orden_compra_servicio: "",
            tabla_personalizada_codigo: "",
            formato_de_pdf: "",
            items: comprobante.detalles.map(d => ({
                unidad_de_medida: "NIU",
                codigo: "",
                codigo_producto_sunat: "",
                descripcion: d.descripcion,
                cantidad: Number(d.cantidad),
                valor_unitario: Number(d.valorUnitario),
                precio_unitario: Number(d.precioUnitario),
                descuento: "",
                subtotal: Number(d.subtotal),
                tipo_de_igv: 1, // 1: Gravado - Operación Onerosa
                igv: Number(d.igv),
                total: Number(d.total),
                anticipo_regularizacion: "false",
                anticipo_documento_serie: "",
                anticipo_documento_numero: ""
            }))
        };

        const NUBEFACT_URL = process.env.NUBEFACT_URL;
        const NUBEFACT_TOKEN = process.env.NUBEFACT_TOKEN;

        if (!NUBEFACT_URL || !NUBEFACT_TOKEN) {
            throw new Error("Credenciales de Nubefact no configuradas en el entorno.");
        }

        // 3. Ejecutar llamada HTTP
        console.log(`[Nubefact] Payload preparado. Enviando a ${NUBEFACT_URL}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch(NUBEFACT_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${NUBEFACT_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const responseData = await response.json();

            if (!response.ok || responseData.errors) {
                // Nubefact devuelve 200 a veces pero con un campo errors o 400
                const errorMsg = responseData.errors || responseData.message || "Error desconocido de Nubefact";
                throw new Error(errorMsg);
            }

            return { 
                success: true, 
                id: responseData.serie_y_numero || `NBF-${Date.now()}`,
                enlace_del_pdf: responseData.enlace_del_pdf,
                enlace_del_xml: responseData.enlace_del_xml,
                enlace_del_cdr: responseData.enlace_del_cdr,
                sunat_ticket_numero: responseData.sunat_ticket_numero,
                sunat_description: responseData.sunat_description
            };

        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                const timeoutErr = new Error('Timeout de 15s esperando a Nubefact');
                (timeoutErr as any).sunatCode = "NUBEFACT_TIMEOUT";
                throw timeoutErr; // Esto sí debe reintentarse
            }
            console.error(`[Nubefact] Error en API: ${error.message}`);
            // Si es un error de validación (400), no lo marcamos para reintento automático
            const customError = new Error(`Rechazo Nubefact: ${error.message}`);
            (customError as any).isValidationError = true;
            throw customError;
        }
    }
}
