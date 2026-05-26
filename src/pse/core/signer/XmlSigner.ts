import { SignedXml } from 'xml-crypto';

export class XmlSigner {
    /**
     * Firma el XML con la ubicación correcta (ExtensionContent) para que el contexto
     * de namespaces sea idéntico al que SUNAT usará al verificar.
     * Extrae solo el bloque <ds:Signature> y lo inyecta en el XML original para
     * evitar que xml-crypto re-serialice el resto del documento.
     */
    static sign(xmlStr: string, privateKeyPem: string, certBase64: string): { signedXml: string, signatureHash: string } {
        const sig = new SignedXml({
            privateKey: privateKeyPem,
            signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
            canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
        });

        // Incluir X509Certificate en KeyInfo (requerido por SUNAT)
        (sig as any).getKeyInfoContent = ({ prefix }: { prefix: string }) => {
            const pfx = prefix ? `${prefix}:` : '';
            return `<${pfx}X509Data><${pfx}X509Certificate>${certBase64}</${pfx}X509Certificate></${pfx}X509Data>`;
        };

        // Referencia al documento completo con enveloped-signature + C14N
        sig.addReference({
            xpath: "//*[local-name(.)='Invoice']",
            transforms: [
                'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
                'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
            ],
            digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
            uri: '',
            digestValue: '',
            isEmptyUri: true,
        });

        // Computar firma con location=ExtensionContent
        sig.computeSignature(xmlStr, {
            prefix: 'ds',
            attrs: { Id: 'SignatureSP' },
            location: {
                reference: "//*[local-name(.)='ExtensionContent']",
                action: 'append',
            },
        });

        // Extraer SOLO el bloque <ds:Signature>
        const signedXmlOutput = sig.getSignedXml();
        const sigMatch = signedXmlOutput.match(/<ds:Signature[\s\S]*?<\/ds:Signature>/);
        if (!sigMatch) throw new Error('No se pudo extraer el bloque de firma del XML firmado');

        const finalXml = xmlStr.replace(
            '<ext:ExtensionContent/>',
            `<ext:ExtensionContent>${sigMatch[0]}</ext:ExtensionContent>`
        );

        // Extraer DigestValue para el código QR
        const digestMatch = finalXml.match(/<ds:DigestValue>(.*?)<\/ds:DigestValue>/);
        const signatureHash = digestMatch ? digestMatch[1] : '';

        return { signedXml: finalXml, signatureHash };
    }
}
