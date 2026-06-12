import { Controller, Get, Post, Body, Param, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { LogsService } from './logs.service';
import * as fs from 'fs';

@Controller('logs')
export class LogsController {
  private readonly logger = new Logger('FrontendErrorLogger');

  constructor(private readonly logsService: LogsService) {}

  @Get()
  // @UseGuards(SuperAdminGuard) // TODO: Proteger esta ruta con roles de Admin cuando se implementen Roles
  listLogs() {
    return {
      success: true,
      data: this.logsService.listFiles()
    };
  }

  @Get('download/:filename')
  // @UseGuards(SuperAdminGuard) // TODO: Proteger esta ruta
  downloadLog(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.logsService.getFilePath(filename);
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  @Post('frontend')
  receiveFrontendError(@Body() data: any) {
    // Registramos el error proveniente del Frontend
    this.logger.error(`[Frontend Error] ${data.message || 'Error desconocido'}`, {
      module: data.module || 'Frontend',
      url: data.url,
      userAgent: data.userAgent,
      errorInfo: data.errorInfo,
      stack: data.stack,
    });
    return { success: true, message: 'Log registrado' };
  }
}
