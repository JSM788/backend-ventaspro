import { Controller, Get, Post, Body } from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';

@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly cotizacionesService: CotizacionesService) {}

  @Get()
  findAll() {
    return this.cotizacionesService.findAll();
  }

  @Post()
  create(@Body() data: any) {
    return this.cotizacionesService.create(data);
  }
}
