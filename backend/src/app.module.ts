import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheableMemory } from 'cacheable';
import { createKeyv } from '@keyv/redis';
import { Keyv } from 'keyv';
import { AdminModule } from './admin/admin.module';
import { AiServicesModule } from './ai-services/ai-services.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConsumerModule } from './consumer/consumer.module';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        stores: [
          new Keyv({
            store: new CacheableMemory({ ttl: configService.cacheTtl * 1000, lruSize: 5000 }),
          }),
          createKeyv(
            `redis://${configService.redisHost}:${configService.redisPort}`,
            {
              namespace: configService.redisPrefix,
            },
          ),
        ],
      }),
    }),
    PrismaModule,
    AdminModule,
    AuthModule,
    ConsumerModule,
    AiServicesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
