import { Controller, Get, Post, Delete, Body, Param, Headers, BadRequestException } from '@nestjs/common';
import { FinanzasService } from './finanzas.service';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';

@Controller('finanzas')
export class FinanzasController {
  constructor(private readonly finanzasService: FinanzasService) {}

  @Get('cuentas')
  async getCuentas(@CurrentTenant() empresaId: string) {
    if (!empresaId) throw new BadRequestException('Falta empresaId en el token');
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
