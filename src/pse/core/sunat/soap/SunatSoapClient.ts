import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';

export class SunatSoapClient {
    static async sendBill(
        empresa: any, 
        comprobante: any, 
        signedXml: string
    ): Promise<{ cdrBuffer: Buffer | null, xmlString: string, xmlFileName: string, zipFileName: string | null }> {
        const tipoCpe = (comprobante.tipo === '01' || comprobante.tipo.toLowerCase() === 'factura') ? '01' : '03';
        const correlativoStr = String(comprobante.correlativo).padStart(7, '0');
        
        const xmlFileName = `${empresa.ruc}-${tipoCpe}-${comprobante.serie}-${correlativoStr}.xml`;
        const zipFileName = `${empresa.ruc}-${tipoCpe}-${comprobante.serie}-${correlativoStr}.zip`;

        // 1. Comprimir en ZIP
        const zip = new AdmZip();
        zip.addFile(xmlFileName, Buffer.from(signedXml, 'utf-8'));
        const zipBuffer = zip.toBuffer();
        const base64Zip = zipBuffer.toString('base64');

        // 2. SOAP Request
        const wsUser = `${empresa.ruc}${empresa.sunatUsuario}`;
        const wsPass = empresa.sunatClave;
        const auth = Buffer.from(`${wsUser}:${wsPass}`).toString('base64');

        const soapEnvelope = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe">
    <soapenv:Header/>
    <soapenv:Body>
        <ser:sendBill>
            <fileName>${zipFileName}</fileName>
            <contentFile>${base64Zip}</contentFile>
        </ser:sendBill>
    </soapenv:Body>
</soapenv:Envelope>`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            const response = await fetch('https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml;charset=UTF-8',
                    'SOAPAction': 'urn:sendBill',
                    'Authorization': `Basic ${auth}`
                },
                body: soapEnvelope,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const soapResponseText = await response.text();

        if (soapResponseText.includes('faultstring')) {
            const match = soapResponseText.match(/<faultstring>(.*?)<\/faultstring>/s);
            const errorMsg = match ? match[1] : 'Error desconocido en SUNAT';
            const customError = new Error(errorMsg);
            (customError as any).sunatCode = 'SUNAT_RECHAZO';
            throw customError;
        }

        const cdrMatch = soapResponseText.match(/<applicationResponse>(.*?)<\/applicationResponse>/s);
        const cdrBase64 = cdrMatch ? cdrMatch[1].trim() : '';
        const cdrBuffer = cdrBase64 ? Buffer.from(cdrBase64, 'base64') : null;

        return { 
            cdrBuffer, 
            xmlString: signedXml,
            xmlFileName,
            zipFileName: cdrBase64 ? `R-${zipFileName}` : null
        };
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                const timeoutErr = new Error('Timeout de 15s esperando a SUNAT');
                (timeoutErr as any).isNetworkError = true;
                (timeoutErr as any).code = 'TIMEOUT';
                throw timeoutErr;
            }
            throw error;
        }
    }
}
