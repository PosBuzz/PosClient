import './timezone';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { configureApp } from './app.setup';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const configService = app.get(ConfigService);
  configureApp(app, configService);
  const PORT = configService.port;
  await app.listen(PORT);
  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.log(`Environment: ${configService.nodeEnv}`);
  logger.log(`CORS Origins: ${configService.corsOrigins.join(', ')}`);
}

void bootstrap();
