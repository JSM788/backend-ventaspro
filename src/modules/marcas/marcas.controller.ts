import { Controller, Get, Post, Body, Param, Delete } from '@nestjs/common';
import { MarcasService } from './marcas.service';

@Controller('marcas')
export class MarcasController {
  constructor(private readonly marcasService: MarcasService) {}

  @Post()
  create(@Body() createMarcaDto: any) {
    return this.marcasService.create(createMarcaDto);
  }

  @Get()
  findAll() {
    return this.marcasService.findAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.marcasService.remove(+id);
  }
}
