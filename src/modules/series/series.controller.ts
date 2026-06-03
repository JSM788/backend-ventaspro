import { Controller, Get, Post, Body, Param, Delete, ParseIntPipe, Query } from '@nestjs/common';
import { SeriesService } from './series.service';

@Controller('series')
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @Get()
  getAll(@Query('tipo') tipo?: string) {
    return this.seriesService.getAll(tipo);
  }

  @Post()
  create(@Body() data: { tipoComprobante: string; serie: string; correlativoInicio: number }) {
    return this.seriesService.create(data);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.seriesService.remove(id);
  }
}
