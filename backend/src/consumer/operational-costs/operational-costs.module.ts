import { Module } from '@nestjs/common';
import { OperationalCostsController } from './controllers/operational-costs.controller';
import { OperationalCostsService } from './services/operational-costs.service';

@Module({
  controllers: [OperationalCostsController],
  providers: [OperationalCostsService],
})
export class OperationalCostsModule {}
