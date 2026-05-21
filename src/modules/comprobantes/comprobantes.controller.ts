import { Controller, Get, Post, Body } from '@nestjs/common';
import { ComprobantesService } from './comprobantes.service';

@Controller('comprobantes')
export class ComprobantesController {
  constructor(private readonly comprobantesService: ComprobantesService) {}

  @Get()
  findAll() {
    return this.comprobantesService.findAll();
  }

  @Get('summary')
  getSummary() {
    return this.comprobantesService.getSummary();
  }

  @Post()
  create(@Body() data: any) {
    return this.comprobantesService.create(data);
  }
}
