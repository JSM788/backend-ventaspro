import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { TiendaVirtualService } from './tienda-virtual.service';
import { Public } from '../../core/auth/public.decorator';

@Controller('v1/tienda')
export class TiendaVirtualController {
  constructor(private readonly tiendaVirtualService: TiendaVirtualService) {}

  @Public()
  @Get(':slug')
  getEmpresaConfig(@Param('slug') slug: string) {
    return this.tiendaVirtualService.getEmpresaBySlug(slug);
  }

  @Public()
  @Get(':slug/productos')
  getProductosPublicos(@Param('slug') slug: string) {
    return this.tiendaVirtualService.getProductosBySlug(slug);
  }

  @Public()
  @Post(':slug/checkout')
  procesarCheckout(@Param('slug') slug: string, @Body() body: any) {
    return this.tiendaVirtualService.procesarCheckout(slug, body);
  }
}
