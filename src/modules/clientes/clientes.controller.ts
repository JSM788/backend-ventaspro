import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get('validar/:numero')
  validateRuc(@CurrentTenant() empresaId: string, @Param('numero') numero: string) {
    return this.clientesService.validateRuc(empresaId, numero);
  }

  @Post()
  create(@CurrentTenant() empresaId: string, @Body() createClienteDto: any) {
    return this.clientesService.create(empresaId, createClienteDto);
  }

  @Get()
  findAll(@CurrentTenant() empresaId: string) {
    return this.clientesService.findAll(empresaId);
  }

  @Get(':id')
  findOne(@CurrentTenant() empresaId: string, @Param('id') id: string) {
    return this.clientesService.findOne(+id, empresaId);
  }

  @Patch(':id')
  update(@CurrentTenant() empresaId: string, @Param('id') id: string, @Body() updateClienteDto: any) {
    return this.clientesService.update(+id, empresaId, updateClienteDto);
  }

  @Delete(':id')
  remove(@CurrentTenant() empresaId: string, @Param('id') id: string) {
    return this.clientesService.remove(+id, empresaId);
  }
}
