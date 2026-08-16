import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AiServicesModule } from './ai-services/ai-services.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from './config/config.module';
import { ConsumerModule } from './consumer/consumer.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    CommonModule,
    PrismaModule,
    AdminModule,
    AuthModule,
    ConsumerModule,
    AiServicesModule,
    PortfolioModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
