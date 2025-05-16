import { Module } from '@nestjs/common';
import { DescriptionController } from './controllers/description.controller';
import { DescriptionService } from './services/description.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [DescriptionController],
  providers: [DescriptionService],
})
export class AiServicesModule {}
