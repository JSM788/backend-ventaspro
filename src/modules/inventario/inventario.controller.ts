import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { InventarioService, RegistrarMovimientoDto } from './inventario.service';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';

@Controller('v1/inventario')
export class InventarioController {
  constructor(private readonly inventarioService: InventarioService) {}

  @Post('movimiento')
  async registrarMovimiento(@CurrentTenant() empresaId: string, @Body() data: RegistrarMovimientoDto) {
    return await this.inventarioService.registrarMovimiento(empresaId, data);
  }

  @Get('stock/lista')
  async listarStock(@CurrentTenant() empresaId: string, @Query('almacenId') almacenId?: string) {
    const stock = await this.inventarioService.listarStock(empresaId, almacenId);
    return { stock };
  }

  @Get('movimientos/lista')
  async listarMovimientos(@CurrentTenant() empresaId: string, @Query('almacenId') almacenId?: string) {
    const movimientos = await this.inventarioService.listarMovimientos(empresaId, almacenId);
    return { movimientos };
  }

  @Get('stock/:productoId')
  async obtenerStock(
    @CurrentTenant() empresaId: string,
    @Param('productoId') productoId: string,
    @Query('almacenId') almacenId?: string
  ) {
    const stock = await this.inventarioService.obtenerStock(empresaId, Number(productoId), almacenId);
    return { stock };
  }

  @Get('kardex/resumen')
  async obtenerResumenKardex(@CurrentTenant() empresaId: string) {
    return await this.inventarioService.obtenerResumenKardex(empresaId);
  }

  @Get('kardex/:productoId')
  async obtenerKardex(
    @CurrentTenant() empresaId: string,
    @Param('productoId') productoId: string,
    @Query('almacenId') almacenId?: string
  ) {
    const historial = await this.inventarioService.obtenerKardex(empresaId, Number(productoId), almacenId);
    return { historial };
  }

  @Get('almacenes')
  async listarAlmacenes(@CurrentTenant() empresaId: string) {
    return await this.inventarioService.listarAlmacenes(empresaId);
  }

  @Get('traslados/lista')
  async listarTraslados(@CurrentTenant() empresaId: string) {
    const traslados = await this.inventarioService.listarTraslados(empresaId);
    return { traslados };
  }

  @Post('traslados')
  async crearTraslado(@CurrentTenant() empresaId: string, @Body() data: import('./dto/crear-traslado.dto').CrearTrasladoDto) {
    return await this.inventarioService.crearTraslado(empresaId, data);
  }
}
