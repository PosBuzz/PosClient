import { Module } from '@nestjs/common';
import { AdminCacheController } from './cache.controller';

@Module({
  controllers: [AdminCacheController],
})
export class CacheModule {}
