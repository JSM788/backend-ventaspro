import { Module } from '@nestjs/common';
import { FinanzasController } from './finanzas.controller';
import { FinanzasService } from './finanzas.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [FinanzasController],
  providers: [FinanzasService],
})
export class FinanzasModule {}
