import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './core/logger/winston.config';
import { GlobalExceptionFilter } from './core/filters/global-exception.filter';
import { TransformResponseInterceptor } from './core/interceptors/transform-response.interceptor';

// Inicializar el worker de la cola de facturación
import './pse/queues/worker/FacturacionWorker';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: WinstonModule.createLogger(winstonConfig),
  });
  
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());
  
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  app.setGlobalPrefix('api');

  // Servir archivos estáticos de la carpeta /uploads
  // Accesibles en: http://localhost:3001/uploads/empresas/{id}/logo-claro.webp
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();