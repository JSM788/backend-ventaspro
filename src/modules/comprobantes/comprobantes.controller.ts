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

import { PseService } from '../../pse/core/providers/pse.service';
import { Public } from '../../core/auth/public.decorator';

@Controller('comprobantes')
export class ComprobantesController {
  constructor(
    private readonly comprobantesService: ComprobantesService,
    private readonly pseService: PseService
  ) {}

  @Get()
  findAll(
    @CurrentTenant() empresaId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('serie') serie?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('tipo') tipo?: string | string[]
  ) {
    return this.comprobantesService.findAll({
      empresaId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search,
      estado,
      serie,
      fechaInicio,
      fechaFin,
      tipo
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
  consolidar(@CurrentTenant() empresaId: string, @Body() data: { notasVentaIds: string[], clienteId?: number, clienteRuc?: string, clienteNombre?: string, tipoComprobante: string, serie: string }) {
    return this.comprobantesService.consolidar({ empresaId, ...data });
  }

  @Post()
  create(@CurrentTenant() empresaId: string, @Body() data: any) {
    return this.comprobantesService.create(empresaId, data);
  }

  @Post(':id/anular')
  async anular(@Param('id') id: string) {
    return this.comprobantesService.anular(id);
  }

  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    const result = await this.pseService.emitir(id);

    if (result.sunatStatus) {
      await db.comprobante.update({
        where: { id },
        data: {
          estadoSunat: result.sunatStatus as any,
          sunatResponseMsg: result.message,
          xmlPath: result.xmlUrl,
          cdrPath: result.cdrUrl,
        }
      });
    }

    if (result.success) {
      return {
        success: true,
        message: result.message,
        xmlUrl: result.xmlUrl,
        cdrUrl: result.cdrUrl,
        viaEmision: result.viaEmision,
      };
    } else {
      // Si el proveedor lanza error, lanzamos un BusinessException (que creamos en Fase 2)
      // O simplemente retornamos el error controlado
      throw new HttpException(
        { errorCode: result.errorCode || 'ERR_PSE', message: result.message },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Public()
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
      const correlativoStr = String(comprobante.correlativo).padStart(8, '0');
      const filename = `${comprobante.empresa!.ruc}-${tipoCpe}-${comprobante.serie}-${correlativoStr}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error generando PDF on-demand:', error);
      res.status(500).send('Error generando PDF');
    }
  }

  @Public()
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
