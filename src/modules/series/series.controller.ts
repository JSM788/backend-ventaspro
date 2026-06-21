import { Controller, Get, Post, Body, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { SeriesService } from './series.service';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';

@Controller('series')
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @Get()
  getAll(@CurrentTenant() empresaId: string, @Query('tipo') tipo?: string) {
    return this.seriesService.getAll(empresaId, tipo);
  }

  @Post()
  create(@CurrentTenant() empresaId: string, @Body() data: { tipoComprobante: string; serie: string; correlativoInicio: number }) {
    return this.seriesService.create(empresaId, data);
  }

  @Delete(':id')
  remove(@CurrentTenant() empresaId: string, @Param('id', ParseIntPipe) id: number) {
    return this.seriesService.remove(empresaId, id);
  }
}
