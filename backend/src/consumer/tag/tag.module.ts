import { Module } from '@nestjs/common';
import { TagController } from './controllers/tag.controller';
import { TagService } from './services/tag.service';

@Module({
  controllers: [TagController],
  providers: [TagService],
})
export class TagModule {}