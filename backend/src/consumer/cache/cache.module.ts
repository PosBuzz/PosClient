import { Module } from '@nestjs/common';
import { CacheController } from './cache.controller';
import { CommonModule } from '../../common/common.module';

@Module({
  controllers: [CacheController],
})
export class CacheModule {}
