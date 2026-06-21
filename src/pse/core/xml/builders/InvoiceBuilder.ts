export class InvoiceBuilder {
    static build(comprobante: any): string {
        const empresa = comprobante.empresa;
        const cliente = comprobante.cliente;
        const detalles = comprobante.detalles;

        const tipoCpe = (comprobante.tipo === '01' || comprobante.tipo.toLowerCase() === 'factura') ? '01' : '03';
        const fechaEmision = comprobante.fechaEmision.toISOString().split('T')[0];
        const horaEmision = comprobante.fechaEmision.toISOString().split('T')[1].split('.')[0];

        const opGravada = Number(comprobante.operacionGravada).toFixed(2);
        const opExonerada = Number(comprobante.operacionExonerada).toFixed(2);
        const opInafecta = Number(comprobante.operacionInafecta).toFixed(2);
        const totalIgv = Number(comprobante.igv).toFixed(2);
        const total = Number(comprobante.total).toFixed(2);

        // Generar líneas de detalle
        const lineasDetalle = detalles.map((d: any, i: number) => {
            const valorUnitario = Number(d.valorUnitario).toFixed(10);
            const cantidad = Number(d.cantidad).toFixed(2);
            const subtotal = Number(d.subtotal).toFixed(2);
            const igvItem = Number(d.igv).toFixed(2);
            const totalItem = Number(d.total).toFixed(2);
            return `
    <cac:InvoiceLine>
        <cbc:ID>${i + 1}</cbc:ID>
        <cbc:InvoicedQuantity unitCode="NIU">${cantidad}</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount currencyID="${comprobante.moneda}">${subtotal}</cbc:LineExtensionAmount>
        <cac:PricingReference>
            <cac:AlternativeConditionPrice>
                <cbc:PriceAmount currencyID="${comprobante.moneda}">${Number(d.precioUnitario).toFixed(2)}</cbc:PriceAmount>
                <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
            </cac:AlternativeConditionPrice>
        </cac:PricingReference>
        <cac:TaxTotal>
            <cbc:TaxAmount currencyID="${comprobante.moneda}">${igvItem}</cbc:TaxAmount>
            <cac:TaxSubtotal>
                <cbc:TaxableAmount currencyID="${comprobante.moneda}">${subtotal}</cbc:TaxableAmount>
                <cbc:TaxAmount currencyID="${comprobante.moneda}">${igvItem}</cbc:TaxAmount>
                <cac:TaxCategory>
                    <cbc:ID>S</cbc:ID>
                    <cbc:Percent>18</cbc:Percent>
                    <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
                    <cac:TaxScheme>
                        <cbc:ID>1000</cbc:ID>
                        <cbc:Name>IGV</cbc:Name>
                        <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                    </cac:TaxScheme>
                </cac:TaxCategory>
            </cac:TaxSubtotal>
        </cac:TaxTotal>
        <cac:Item>
            <cbc:Description><![CDATA[${d.descripcion}]]></cbc:Description>
        </cac:Item>
        <cac:Price>
            <cbc:PriceAmount currencyID="${comprobante.moneda}">${valorUnitario}</cbc:PriceAmount>
        </cac:Price>
    </cac:InvoiceLine>`;
        }).join('');

        // Tipo de documento del cliente (6 = RUC, 1 = DNI)
        const tipoDocCliente = cliente.ruc.length === 11 ? '6' : '1';

        const correlativoStr = String(comprobante.correlativo).padStart(8, '0');

        const isCredito = comprobante.condicionPago?.toUpperCase() === 'CREDITO';
        
        let paymentTermsStr = `
    <cac:PaymentTerms>
        <cbc:ID>FormaPago</cbc:ID>
        <cbc:PaymentMeansID>${isCredito ? 'Credito' : 'Contado'}</cbc:PaymentMeansID>${isCredito ? `\n        <cbc:Amount currencyID="${comprobante.moneda}">${total}</cbc:Amount>` : ''}
    </cac:PaymentTerms>`;

        if (isCredito && comprobante.cuotas && comprobante.cuotas.length > 0) {
            comprobante.cuotas.forEach((cuota: any, index: number) => {
                const fechaCuota = cuota.fechaVencimiento.toISOString().split('T')[0];
                const montoCuota = Number(cuota.monto).toFixed(2);
                paymentTermsStr += `
    <cac:PaymentTerms>
        <cbc:ID>FormaPago</cbc:ID>
        <cbc:PaymentMeansID>Cuota${String(index + 1).padStart(3, '0')}</cbc:PaymentMeansID>
        <cbc:Amount currencyID="${comprobante.moneda}">${montoCuota}</cbc:Amount>
        <cbc:PaymentDueDate>${fechaCuota}</cbc:PaymentDueDate>
    </cac:PaymentTerms>`;
            });
        }

        return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
    xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
    xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
    xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
    <ext:UBLExtensions>
        <ext:UBLExtension>
            <ext:ExtensionContent/>
        </ext:UBLExtension>
    </ext:UBLExtensions>
    <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
    <cbc:CustomizationID>2.0</cbc:CustomizationID>
    <cbc:ProfileID schemeName="Tipo de Operacion" schemeAgencyName="PE:SUNAT" schemeURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo51">${comprobante.tipoOperacion || '0101'}</cbc:ProfileID>
    <cbc:ID>${comprobante.serie}-${correlativoStr}</cbc:ID>
    <cbc:IssueDate>${fechaEmision}</cbc:IssueDate>
    <cbc:IssueTime>${horaEmision}</cbc:IssueTime>
    <cbc:InvoiceTypeCode listID="0101" listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">${tipoCpe}</cbc:InvoiceTypeCode>
    <cbc:Note><![CDATA[SON ${total} SOLES]]></cbc:Note>
    <cbc:DocumentCurrencyCode>${comprobante.moneda}</cbc:DocumentCurrencyCode>
    <cac:Signature>
        <cbc:ID>${empresa.ruc}</cbc:ID>
        <cac:SignatoryParty>
            <cac:PartyIdentification><cbc:ID>${empresa.ruc}</cbc:ID></cac:PartyIdentification>
            <cac:PartyName><cbc:Name><![CDATA[${empresa.razonSocial}]]></cbc:Name></cac:PartyName>
        </cac:SignatoryParty>
        <cac:DigitalSignatureAttachment>
            <cac:ExternalReference><cbc:URI>#SignatureSP</cbc:URI></cac:ExternalReference>
        </cac:DigitalSignatureAttachment>
    </cac:Signature>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="6">${empresa.ruc}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName><![CDATA[${empresa.razonSocial}]]></cbc:RegistrationName>
                <cac:RegistrationAddress>
                    <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
                    <cac:Country>
                        <cbc:IdentificationCode>PE</cbc:IdentificationCode>
                    </cac:Country>
                </cac:RegistrationAddress>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyIdentification>
                <cbc:ID schemeID="${tipoDocCliente}">${cliente.ruc}</cbc:ID>
            </cac:PartyIdentification>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName><![CDATA[${cliente.razonSocial}]]></cbc:RegistrationName>
            </cac:PartyLegalEntity>
        </cac:Party>
    </cac:AccountingCustomerParty>
${paymentTermsStr}
    <cac:TaxTotal>
        <cbc:TaxAmount currencyID="${comprobante.moneda}">${totalIgv}</cbc:TaxAmount>
        <cac:TaxSubtotal>
            <cbc:TaxableAmount currencyID="${comprobante.moneda}">${opGravada}</cbc:TaxableAmount>
            <cbc:TaxAmount currencyID="${comprobante.moneda}">${totalIgv}</cbc:TaxAmount>
            <cac:TaxCategory>
                <cbc:ID>S</cbc:ID>
                <cbc:Percent>18</cbc:Percent>
                <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
                <cac:TaxScheme>
                    <cbc:ID>1000</cbc:ID>
                    <cbc:Name>IGV</cbc:Name>
                    <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
                </cac:TaxScheme>
            </cac:TaxCategory>
        </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:LegalMonetaryTotal>
        <cbc:LineExtensionAmount currencyID="${comprobante.moneda}">${opGravada}</cbc:LineExtensionAmount>
        <cbc:TaxInclusiveAmount currencyID="${comprobante.moneda}">${total}</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount currencyID="${comprobante.moneda}">${total}</cbc:PayableAmount>
    </cac:LegalMonetaryTotal>${lineasDetalle}
</Invoice>`;
    }
}
