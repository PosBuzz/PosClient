import { Module } from '@nestjs/common';
import { CacheController } from './cache.controller';
import { CacheService } from '../../common/services/cache.service';

@Module({
  controllers: [CacheController],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheModule {}
