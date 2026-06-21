import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { CategoriasService } from './categorias.service';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Post()
  create(@CurrentTenant() empresaId: string, @Body() createCategoriaDto: any) {
    return this.categoriasService.create(empresaId, createCategoriaDto);
  }

  @Get()
  findAll(@CurrentTenant() empresaId: string) {
    return this.categoriasService.findAll(empresaId);
  }

  @Delete(':id')
  remove(@CurrentTenant() empresaId: string, @Param('id') id: string) {
    return this.categoriasService.remove(empresaId, +id);
  }
}
