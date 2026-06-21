import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { DevolucionesProveedorService } from './devoluciones-proveedor.service';
import { CreateDevolucionProveedorDto } from './dto/create-devolucion.dto';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';

@Controller('v1/logistica/devoluciones-proveedor')
export class DevolucionesProveedorController {
  constructor(private readonly devolucionesService: DevolucionesProveedorService) {}

  @Post()
  create(@CurrentTenant() empresaId: string, @Body() createDto: CreateDevolucionProveedorDto) {
    return this.devolucionesService.create(empresaId, createDto);
  }

  @Get()
  findAll(@CurrentTenant() empresaId: string) {
    return this.devolucionesService.findAll(empresaId);
  }

  @Get(':id')
  findOne(@CurrentTenant() empresaId: string, @Param('id') id: string) {
    return this.devolucionesService.findOne(empresaId, id);
  }
}
