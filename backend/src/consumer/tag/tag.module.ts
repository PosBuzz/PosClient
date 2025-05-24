import { Module } from '@nestjs/common';
import { TagController } from './controllers/tag.controller';
import { TagService } from './services/tag.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  controllers: [TagController],
  providers: [TagService],
})
export class TagModule {}