import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { TiposClienteService } from './tipos-cliente.service';

@Controller('tipos-cliente')
export class TiposClienteController {
  constructor(private readonly tiposClienteService: TiposClienteService) {}

  @Post()
  create(@Body() data: any) {
    return this.tiposClienteService.create(data);
  }

  @Get()
  findAll() {
    return this.tiposClienteService.findAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tiposClienteService.remove(+id);
  }
}
