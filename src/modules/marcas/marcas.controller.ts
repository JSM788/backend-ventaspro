import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { MarcasService } from './marcas.service';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';

@Controller('marcas')
export class MarcasController {
  constructor(private readonly marcasService: MarcasService) {}

  @Post()
  create(@CurrentTenant() empresaId: string, @Body() createMarcaDto: any) {
    return this.marcasService.create(empresaId, createMarcaDto);
  }

  @Get()
  findAll(@CurrentTenant() empresaId: string) {
    return this.marcasService.findAll(empresaId);
  }

  @Delete(':id')
  remove(@CurrentTenant() empresaId: string, @Param('id') id: string) {
    return this.marcasService.remove(empresaId, +id);
  }
}
