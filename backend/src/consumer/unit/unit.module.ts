import { Module } from '@nestjs/common';
import { UnitController } from './controllers/unit.controller';
import { UnitService } from './services/unit.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  controllers: [UnitController],
  providers: [UnitService],
})
export class UnitModule {}