import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { configValidationSchema } from './config.schema';
import { ConfigService } from './config.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { RedisCacheModule } from 'nest-cache-redis';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}.local`,
        '.env',
      ],
      validationSchema: configValidationSchema,
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 3600 * 1000,
          limit: 50,
        },
      ],
    }),
    // Redis is optional and off by default (REDIS_ENABLED). NestConfigModule.forRoot
    // above has already loaded .env into process.env when this line runs.
    ...(process.env.REDIS_ENABLED === 'true'
      ? [
          RedisCacheModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
              redisOptions: {
                host: configService.redisHost,
                port: configService.redisPort,
                password: configService.redisPassword,
                keyPrefix: `${configService.redisPrefix}:`,
                maxRetriesPerRequest: 3,
                enableOfflineQueue: false,
                connectTimeout: 10000,
                commandTimeout: 5000,
                retryStrategy: (times: number) => {
                  const delay = Math.min(times * 100, 3000);
                  return delay;
                },
              },
              ttl: configService.cacheTtl, // TTL in seconds
              fireAndForget: true, // Global fire-and-forget mode
              debug: true, // Enable in development
              isGlobal: true, // Available everywhere
            }),
          }),
        ]
      : []),
  ],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
