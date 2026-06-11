import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EmpresasService } from './empresas.service';

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Get()
  getAllEmpresas() {
    return this.empresasService.getAllEmpresas();
  }

  @Get('planes')
  getPlanes() {
    return this.empresasService.getPlanes();
  }

  @Get('tipos-negocio')
  getTiposNegocio() {
    return this.empresasService.getTiposNegocio();
  }

  @Post()
  createEmpresa(@Body() data: any) {
    return this.empresasService.createEmpresaCompleta(data);
  }

  @Put(':id')
  updateEmpresa(@Param('id') id: string, @Body() data: any) {
    return this.empresasService.updateEmpresa(id, data);
  }

  @Get('config')
  getConfig(@Req() req: any) {
    return this.empresasService.getConfig(req.user?.empresaId);
  }

  @Post('config')
  createConfig(@Body() data: any, @Req() req: any) {
    return this.empresasService.createConfig(data, req.user?.empresaId);
  }

  @Put('config')
  updateConfig(@Body() data: any, @Req() req: any) {
    return this.empresasService.updateConfig(data, req.user?.empresaId);
  }

  /**
   * POST /api/empresas/config/logo/:tipo
   * Sube el logo de la empresa. tipo = 'claro' | 'oscuro'
   * Acepta multipart/form-data con campo "imagen"
   */
  @Post('config/logo/:tipo')
  @UseInterceptors(
    FileInterceptor('imagen', {
      storage: memoryStorage(), // Usamos memoryStorage para pasar el buffer a sharp
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máximo
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
  uploadLogo(
    @Param('tipo') tipo: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    if (tipo !== 'claro' && tipo !== 'oscuro') {
      throw new BadRequestException('El parámetro tipo debe ser "claro" u "oscuro"');
    }
    return this.empresasService.uploadLogo(tipo, file, req.user?.empresaId);
  }

}
