import { Controller, Get, Post, Body, Query, Param, Res, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ComprobantesService } from './comprobantes.service';
import { NubefactProvider } from '../../infrastructure/providers/NubefactProvider';
import { db } from '../../infrastructure/database';
import { InvoiceBuilder } from '../../pse/core/xml/builders/InvoiceBuilder';
import { XmlSigner } from '../../pse/core/signer/XmlSigner';
import { SunatSoapClient } from '../../pse/core/sunat/soap/SunatSoapClient';

import { CurrentTenant } from '../../core/auth/current-tenant.decorator';

@Controller('comprobantes')
export class ComprobantesController {
  constructor(private readonly comprobantesService: ComprobantesService) {}

  @Get()
  findAll(
    @CurrentTenant() empresaId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('serie') serie?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string
  ) {
    return this.comprobantesService.findAll({
      empresaId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search,
      estado,
      serie,
      fechaInicio,
      fechaFin
    });
  }

  @Get('summary')
  getSummary(
    @CurrentTenant() empresaId: string,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('serie') serie?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string
  ) {
    return this.comprobantesService.getSummary({
      empresaId, search, estado, serie, fechaInicio, fechaFin
    });
  }

  @Post('consolidar')
  consolidar(@CurrentTenant() empresaId: string, @Body() data: { notasVentaIds: string[], clienteId: number, tipoComprobante: string, serie: string }) {
    return this.comprobantesService.consolidar({ empresaId, ...data });
  }

  @Post()
  create(@CurrentTenant() empresaId: string, @Body() data: any) {
    return this.comprobantesService.create(empresaId, data);
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    const comprobante = await db.comprobante.findUnique({
      where: { id },
      include: { empresa: true, cliente: true, detalles: true }
    });
    if (!comprobante) throw new HttpException('No encontrado', HttpStatus.NOT_FOUND);

    const tieneCertificado = !!comprobante.empresa?.certificadoBase64;
    const diagnostico: any = {
      id: comprobante.id,
      tipo: comprobante.tipo,
      serie: comprobante.serie,
      correlativo: comprobante.correlativo,
      tieneCertificado,
      estadoActual: comprobante.estadoSunat,
      empresa: {
        id: comprobante.empresa?.id,
        razonSocial: comprobante.empresa?.razonSocial,
        sunatUsuario: comprobante.empresa?.sunatUsuario ?? '(null)',
        sunatClaveSet: !!comprobante.empresa?.sunatClave,
        certificadoBase64Bytes: comprobante.empresa?.certificadoBase64?.length ?? 0,
      },
      xmlPreview: null,
      nubefactResult: null,
      error: null
    };

    try {
      const xml = InvoiceBuilder.build(comprobante);
      diagnostico.xmlPreview = xml.substring(0, 300) + '...';
    } catch (e: any) {
      diagnostico.error = 'Error construyendo XML: ' + e.message;
      return diagnostico;
    }

    // Si NO tiene certificado → ir a Nubefact
    if (!tieneCertificado) {
      // MODO MVP: Dormido
      diagnostico.nubefactResult = { status: 'DORMIDO_MVP', message: 'Simulando aceptación local' };
      diagnostico.estadoActual = 'ACEPTADO';
      await db.comprobante.update({
        where: { id: comprobante.id },
        data: { estadoSunat: 'ACEPTADO', sunatResponseMsg: 'Simulado Aceptado por botón reintentar (MVP)' }
      });
    } else {
      // Tiene certificado: intentar firma + SUNAT
      const tieneCredencialesSunat = !!comprobante.empresa?.sunatUsuario && !!comprobante.empresa?.sunatClave;
      diagnostico.tieneCredencialesSunat = tieneCredencialesSunat;

      // Probar firma del XML
      try {
        const forge = require('node-forge');
        const p12Der = forge.util.decode64(comprobante.empresa!.certificadoBase64);
        const p12Asn1 = forge.asn1.fromDer(p12Der);
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, comprobante.empresa!.certificadoPassword || '');
        let privateKeyPem = '', certPem = '';
        for (const safeContent of p12.safeContents) {
          for (const safeBag of safeContent.safeBags) {
            if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag && safeBag.key)
              privateKeyPem = forge.pki.privateKeyToPem(safeBag.key);
            else if (safeBag.type === forge.pki.oids.certBag && safeBag.cert)
              certPem = forge.pki.certificateToPem(safeBag.cert);
          }
        }
        const certBase64 = certPem.replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/\n/g, '').trim();
        const xml = InvoiceBuilder.build(comprobante);
        const { signedXml } = XmlSigner.sign(xml, privateKeyPem, certBase64);
        diagnostico.firmaOk = true;

        // Probar SUNAT SOAP con timeout corto
        const soapResult = await SunatSoapClient.sendBill(comprobante.empresa!, comprobante, signedXml);
        diagnostico.sunatOk = true;
        diagnostico.sunatResult = { xmlPath: soapResult.xmlFileName, cdrPath: soapResult.zipFileName };
      } catch (e: any) {
        diagnostico.error = 'Error en flujo nativo: ' + e.message;
      }
    }

    return diagnostico;
  }

  @Get(':id/pdf')
  async downloadPdfById(@Param('id') id: string, @Res() res: Response) {
    const comprobante = await db.comprobante.findUnique({
      where: { id },
      include: { empresa: true, cliente: true, detalles: true }
    });
    
    if (!comprobante) {
      return res.status(404).send('Comprobante no encontrado');
    }

    try {
      const { PdfGenerator } = require('../../pse/core/pdf/PdfGenerator');
      const pdfBuffer = await PdfGenerator.generarComprobante(comprobante);

      const tipoCpe = comprobante.tipo === 'NV' ? 'NV' : (comprobante.tipo === '01' ? '01' : '03');
      const correlativoStr = String(comprobante.correlativo).padStart(7, '0');
      const filename = `${comprobante.empresa!.ruc}-${tipoCpe}-${comprobante.serie}-${correlativoStr}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error generando PDF on-demand:', error);
      res.status(500).send('Error generando PDF');
    }
  }

  @Get('download/:type/:filename')
  downloadFile(
    @Param('type') type: string,
    @Param('filename') filename: string,
    @Res() res: Response
  ) {
    const allowedTypes = ['pdf', 'xml', 'cdr'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).send('Tipo de archivo no válido');
    }

    const filePath = path.join(process.cwd(), 'uploads', type, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Archivo no encontrado');
    }

    // Set correct content type
    const contentTypes = {
      pdf: 'application/pdf',
      xml: 'application/xml',
      cdr: 'application/zip'
    };
    
    res.setHeader('Content-Type', contentTypes[type]);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}
