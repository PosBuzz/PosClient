import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AiServicesModule } from './ai-services/ai-services.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConsumerModule } from './consumer/consumer.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60000,
          limit: 50,
        },
      ],
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
