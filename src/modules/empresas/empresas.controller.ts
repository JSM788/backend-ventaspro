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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { EmpresasService } from './empresas.service';

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Get('config')
  getConfig() {
    return this.empresasService.getConfig();
  }

  @Put('config')
  updateConfig(@Body() data: any) {
    return this.empresasService.updateConfig(data);
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
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    if (tipo !== 'claro' && tipo !== 'oscuro') {
      throw new BadRequestException('El parámetro tipo debe ser "claro" u "oscuro"');
    }
    return this.empresasService.uploadLogo(tipo, file);
  }

  @Post('config/certificado')
  @UseInterceptors(
    FileInterceptor('certificado', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadCertificado(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    return this.empresasService.updateCertificado(file, body);
  }
}
