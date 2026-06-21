import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { EstablecimientosService } from './establecimientos.service';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';

@Controller('v1/establecimientos')
export class EstablecimientosController {
  constructor(private readonly establecimientosService: EstablecimientosService) {}

  @Get()
  async findAll(@CurrentTenant() empresaId: string) {
    return this.establecimientosService.findAll(empresaId);
  }

  @Get(':id')
  async findOne(@CurrentTenant() empresaId: string, @Param('id') id: string) {
    return this.establecimientosService.findOne(empresaId, id);
  }

  @Post()
  async create(@CurrentTenant() empresaId: string, @Body() data: any) {
    return this.establecimientosService.create(empresaId, data);
  }

  @Put(':id')
  async update(@CurrentTenant() empresaId: string, @Param('id') id: string, @Body() data: any) {
    return this.establecimientosService.update(empresaId, id, data);
  }

  @Delete(':id')
  async remove(@CurrentTenant() empresaId: string, @Param('id') id: string) {
    return this.establecimientosService.remove(empresaId, id);
  }
}
