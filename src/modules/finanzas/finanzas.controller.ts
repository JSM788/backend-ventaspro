import { Controller, Get, Post, Delete, Body, Param, Headers, BadRequestException } from '@nestjs/common';
import { FinanzasService } from './finanzas.service';

@Controller('finanzas')
export class FinanzasController {
  constructor(private readonly finanzasService: FinanzasService) {}

  @Get('cuentas')
  async getCuentas(@Headers('x-empresa-id') empresaId: string) {
    if (!empresaId) throw new BadRequestException('Se requiere x-empresa-id');
    return await this.finanzasService.getCuentas(empresaId);
  }

  @Get('pagos/:comprobanteId')
  async getPagosPorComprobante(@Param('comprobanteId') comprobanteId: string) {
    return await this.finanzasService.getPagosPorComprobante(comprobanteId);
  }

  @Post('pagos/:comprobanteId')
  async registrarPago(
    @Param('comprobanteId') comprobanteId: string,
    @Body() data: any
  ) {
    return await this.finanzasService.registrarPago(comprobanteId, data);
  }

  @Delete('pagos/:pagoId')
  async eliminarPago(@Param('pagoId') pagoId: string) {
    return await this.finanzasService.eliminarPago(Number(pagoId));
  }
}
