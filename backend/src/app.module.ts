import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AiServicesModule } from './ai-services/ai-services.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ConsumerModule } from './consumer/consumer.module';

@Module({
  imports: [
    AdminModule,
    AuthModule,
    ConsumerModule,
    AiServicesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
