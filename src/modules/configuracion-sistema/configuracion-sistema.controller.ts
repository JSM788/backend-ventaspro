import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ConfiguracionSistemaService } from './configuracion-sistema.service';


@Controller('configuracion-sistema')
export class ConfiguracionSistemaController {
  constructor(private readonly configService: ConfiguracionSistemaService) {}

  @Get()
  // @UseGuards(SuperAdminGuard) // TODO: Añadir cuando tengamos SuperAdminGuard funcionando
  getConfiguracion() {
    return this.configService.getConfiguracion();
  }

  @Put()
  // @UseGuards(SuperAdminGuard)
  updateConfiguracion(@Body() data: any) {
    return this.configService.updateConfiguracion(data);
  }

  @Post('certificado')
  // @UseGuards(SuperAdminGuard)
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
    return this.configService.updateCertificado(file, body);
  }
}
