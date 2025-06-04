import { Module } from '@nestjs/common';
import { UnitController } from './controllers/unit.controller';
import { UnitService } from './services/unit.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [UnitController],
  providers: [UnitService],
})
export class UnitModule {}