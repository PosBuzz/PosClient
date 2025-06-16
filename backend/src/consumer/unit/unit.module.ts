import { Module } from '@nestjs/common';
import { UnitController } from './controllers/unit.controller';
import { UnitService } from './services/unit.service';

@Module({
  controllers: [UnitController],
  providers: [UnitService],
})
export class UnitModule {}