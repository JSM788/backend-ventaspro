import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { CajasTurnosService } from './cajas-turnos.service';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';
// Asumimos que el usuarioID vendrá temporalmente en el body o usaremos un mock en el MVP,
// ya que CurrentTenant da la empresaId.

@Controller('api/cajas-turnos')
export class CajasTurnosController {
  constructor(private readonly cajasTurnosService: CajasTurnosService) {}

  @Post('aperturar')
  async aperturar(
    @CurrentTenant() empresaId: string, 
    @Body() body: { usuarioId: string; montoInicial: number; cajaCuentaId: number; observaciones?: string }
  ) {
    return this.cajasTurnosService.aperturarTurno(empresaId, body.usuarioId, body);
  }

  @Post('cerrar/:id')
  async cerrar(
    @CurrentTenant() empresaId: string, 
    @Param('id') turnoId: string, 
    @Body() body: { usuarioId: string; montoArqueado: number; observaciones?: string }
  ) {
    return this.cajasTurnosService.cerrarTurno(empresaId, body.usuarioId, turnoId, body);
  }

  @Get('activo/:usuarioId')
  async obtenerActivo(
    @CurrentTenant() empresaId: string, 
    @Param('usuarioId') usuarioId: string
  ) {
    return this.cajasTurnosService.obtenerTurnoActivo(empresaId, usuarioId);
  }

  @Post('movimiento')
  async registrarMovimiento(
    @Body() body: { turnoId: string; tipo: 'INGRESO' | 'EGRESO'; monto: number; descripcion: string }
  ) {
    return this.cajasTurnosService.registrarMovimiento(body.turnoId, body);
  }
}
