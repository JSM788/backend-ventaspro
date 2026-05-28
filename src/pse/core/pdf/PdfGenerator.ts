const PdfPrinter = require('pdfmake');
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

// Standard fonts for pdfmake
const fonts = {
    Roboto: {
        normal: 'node_modules/pdfmake/build/vfs_fonts.js',
        bold: 'node_modules/pdfmake/build/vfs_fonts.js',
        italics: 'node_modules/pdfmake/build/vfs_fonts.js',
        bolditalics: 'node_modules/pdfmake/build/vfs_fonts.js'
    }
};

export class PdfGenerator {
    static async generarComprobante(comprobante: any, xmlHash: string = ''): Promise<Buffer> {
        try {
            // Sintaxis clásica y estable de pdfmake 0.2.x
            const printer = new PdfPrinter({
                Roboto: {
                    normal: Buffer.from(require('pdfmake/build/vfs_fonts.js').pdfMake.vfs['Roboto-Regular.ttf'], 'base64'),
                    bold: Buffer.from(require('pdfmake/build/vfs_fonts.js').pdfMake.vfs['Roboto-Medium.ttf'], 'base64'),
                    italics: Buffer.from(require('pdfmake/build/vfs_fonts.js').pdfMake.vfs['Roboto-Italic.ttf'], 'base64'),
                    bolditalics: Buffer.from(require('pdfmake/build/vfs_fonts.js').pdfMake.vfs['Roboto-MediumItalic.ttf'], 'base64'),
                }
            });

            const empresa = comprobante.empresa;
            const cliente = comprobante.cliente;
            const detalles = comprobante.detalles;

            const esNotaVenta = comprobante.tipo === 'NV';
            const tipoComprobanteStr = esNotaVenta ? 'NOTA DE VENTA' : (comprobante.tipo.toUpperCase() === '01' ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA');
            const tipoCpe = esNotaVenta ? 'NV' : (comprobante.tipo === '01' ? '01' : '03');
            const correlativoStr = String(comprobante.correlativo).padStart(7, '0');
            const fechaEmision = comprobante.fechaEmision.toISOString().split('T')[0];
            const tipoDocCliente = cliente.ruc.length === 11 ? '6' : '1';

            // 1. Generar Código QR (Estándar SUNAT)
            // RUC | TIPO_DOC | SERIE | CORRELATIVO | IGV | TOTAL | FECHA | TIPO_DOC_CLIENTE | NUM_DOC_CLIENTE | HASH |
            const qrText = `${empresa.ruc}|${tipoCpe}|${comprobante.serie}|${correlativoStr}|${Number(comprobante.igv).toFixed(2)}|${Number(comprobante.total).toFixed(2)}|${fechaEmision}|${tipoDocCliente}|${cliente.ruc}|${xmlHash}|`;
            const qrBase64 = await QRCode.toDataURL(qrText, { margin: 1, scale: 4 });

            // 2. Construir cuerpo de tabla de ítems
            const bodyItems = [
                [
                    { text: 'CANT.', style: 'tableHeader', alignment: 'center' },
                    { text: 'DESCRIPCIÓN', style: 'tableHeader' },
                    { text: 'P. UNIT', style: 'tableHeader', alignment: 'right' },
                    { text: 'IMPORTE', style: 'tableHeader', alignment: 'right' }
                ]
            ];

            detalles.forEach((d: any) => {
                bodyItems.push([
                    { text: Number(d.cantidad).toFixed(2), style: 'tableBody', alignment: 'center' },
                    { text: d.descripcion, style: 'tableBody' },
                    { text: Number(d.precioUnitario).toFixed(2), style: 'tableBody', alignment: 'right' },
                    { text: Number(d.total).toFixed(2), style: 'tableBody', alignment: 'right' }
                ]);
            });

            // 3. Definir Documento PDF (Formato JSON de pdfmake)
            const docDefinition: any = {
                pageSize: 'A4',
                pageMargins: [40, 60, 40, 60],
                content: [
                    // CABECERA
                    {
                        columns: [
                            // Datos Empresa
                            {
                                width: '*',
                                stack: [
                                    { text: empresa.razonSocial, fontSize: 14, bold: true, margin: [0, 0, 0, 5] },
                                    { text: `RUC: ${empresa.ruc}`, fontSize: 10, color: '#444' },
                                    { text: empresa.direccion || 'Lima, Perú', fontSize: 10, color: '#444' }
                                ]
                            },
                            // Cuadro Comprobante
                            {
                                width: 220,
                                stack: [
                                    {
                                        table: {
                                            widths: ['*'],
                                            body: [
                                                [{ text: `RUC: ${empresa.ruc}`, alignment: 'center', fontSize: 12, bold: true, margin: [0, 5] }],
                                                [{ text: tipoComprobanteStr, alignment: 'center', fontSize: 12, bold: true, fillColor: '#f3f4f6', margin: [0, 5] }],
                                                [{ text: `${comprobante.serie}-${correlativoStr}`, alignment: 'center', fontSize: 14, bold: true, margin: [0, 5] }]
                                            ]
                                        },
                                        layout: 'borders'
                                    }
                                ]
                            }
                        ],
                        margin: [0, 0, 0, 30]
                    },
                    // DATOS CLIENTE
                    {
                        table: {
                            widths: [80, '*'],
                            body: [
                                [{ text: 'CLIENTE:', bold: true, border: [false, false, false, false] }, { text: cliente.razonSocial, border: [false, false, false, false] }],
                                [{ text: 'RUC/DNI:', bold: true, border: [false, false, false, false] }, { text: cliente.ruc, border: [false, false, false, false] }],
                                [{ text: 'DIRECCIÓN:', bold: true, border: [false, false, false, false] }, { text: cliente.direccion || '-', border: [false, false, false, false] }],
                                [{ text: 'FECHA EMISIÓN:', bold: true, border: [false, false, false, false] }, { text: fechaEmision, border: [false, false, false, false] }],
                                [{ text: 'MONEDA:', bold: true, border: [false, false, false, false] }, { text: comprobante.moneda === 'PEN' ? 'Soles' : 'Dólares', border: [false, false, false, false] }]
                            ]
                        },
                        margin: [0, 0, 0, 20],
                        fontSize: 10
                    },
                    // DETALLE DE PRODUCTOS
                    {
                        table: {
                            headerRows: 1,
                            widths: [50, '*', 60, 60],
                            body: bodyItems
                        },
                        layout: 'lightHorizontalLines',
                        margin: [0, 0, 0, 20]
                    },
                    // TOTALES
                    {
                        columns: [
                            // Espacio vacío o QR
                            {
                                width: '*',
                                stack: [
                                    { image: qrBase64, width: 100 },
                                    { text: esNotaVenta ? 'Documento de control interno.' : `Representación impresa de la ${tipoComprobanteStr}.`, fontSize: 8, margin: [0, 5, 0, 0], color: '#666' }
                                ]
                            },
                            // Resumen
                            {
                                width: 200,
                                table: {
                                    widths: [80, '*'],
                                    body: [
                                        [{ text: 'OP. GRAVADA:', bold: true, border: [false, false, false, false], alignment: 'right' }, { text: Number(comprobante.operacionGravada).toFixed(2), border: [false, false, false, false], alignment: 'right' }],
                                        [{ text: 'OP. INAFECTA:', bold: true, border: [false, false, false, false], alignment: 'right' }, { text: Number(comprobante.operacionInafecta).toFixed(2), border: [false, false, false, false], alignment: 'right' }],
                                        [{ text: 'OP. EXONERADA:', bold: true, border: [false, false, false, false], alignment: 'right' }, { text: Number(comprobante.operacionExonerada).toFixed(2), border: [false, false, false, false], alignment: 'right' }],
                                        [{ text: 'IGV (18%):', bold: true, border: [false, false, false, false], alignment: 'right' }, { text: Number(comprobante.igv).toFixed(2), border: [false, false, false, false], alignment: 'right' }],
                                        [{ text: 'TOTAL:', bold: true, border: [false, true, false, false], alignment: 'right', fontSize: 12 }, { text: Number(comprobante.total).toFixed(2), border: [false, true, false, false], alignment: 'right', fontSize: 12 }]
                                    ]
                                },
                                fontSize: 10
                            }
                        ]
                    }
                ],
                styles: {
                    tableHeader: { bold: true, fontSize: 10, color: 'black', fillColor: '#f3f4f6', margin: [0, 5] },
                    tableBody: { fontSize: 9, margin: [0, 5] }
                },
                defaultStyle: {
                    font: 'Roboto'
                }
            };

            // 4. Generar y retornar el archivo PDF como Buffer
            return new Promise((resolve, reject) => {
                const pdfDoc = printer.createPdfKitDocument(docDefinition);
                const chunks: any[] = [];
                
                pdfDoc.on('data', (chunk: any) => chunks.push(chunk));
                pdfDoc.on('end', () => {
                    const result = Buffer.concat(chunks);
                    resolve(result);
                });
                pdfDoc.on('error', (err: any) => {
                    reject(err);
                });
                
                pdfDoc.end();
            });

        } catch (error) {
            console.error('[PdfGenerator] Error generando PDF:', error);
            throw new Error('Fallo al generar la representación PDF');
        }
    }
}
