import { Controller, Get, Put, Post, Body, Param, UseInterceptors, UploadedFile, BadRequestException, Query } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminTiendaConfiguracionService } from './admin-tienda-configuracion.service';
import { CurrentTenant } from '../../core/auth/current-tenant.decorator';

@Controller('v1/admin/tienda-configuracion')
export class AdminTiendaConfiguracionController {
  constructor(private readonly configService: AdminTiendaConfiguracionService) {}

  @Get()
  getConfiguracion(@CurrentTenant() empresaId: string) {
    return this.configService.getConfiguracion(empresaId);
  }

  @Get('pedidos')
  getPedidosTienda(
    @CurrentTenant() empresaId: string,
    @Query() query: any
  ) {
    return this.configService.getPedidosTienda(empresaId, query);
  }

  @Put()
  updateConfiguracion(@CurrentTenant() empresaId: string, @Body() data: any) {
    return this.configService.updateConfiguracion(empresaId, data);
  }

  @Post('upload/:tipo')
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Solo se aceptan imágenes (JPG, PNG, WebP, SVG)'), false);
        }
      },
    }),
  )
  uploadImage(
    @Param('tipo') tipo: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentTenant() empresaId: string,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    if (tipo !== 'logo' && tipo !== 'banner') {
      throw new BadRequestException('El parámetro tipo debe ser "logo" o "banner"');
    }
    return this.configService.uploadImage(tipo, file, empresaId);
  }
}
