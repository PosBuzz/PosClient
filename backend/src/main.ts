import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import * as csurf from 'csurf';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClientExceptionFilter } from 'prisma-client-exception/prisma-client-exception.filter';
import { PrismaClientValidationExceptionFilter } from 'prisma-client-exception/prisma-client-validation-exception.filter';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  
  // Get config service
  const configService = app.get(ConfigService);

  // CORS Configuration for credentials and allowed origins
  const options = {
    origin: configService.corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    allowedHeaders:
      'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, X-CSRF-TOKEN, Observe, Authorization, ngrok-skip-browser-warning',
    credentials: true, // Allow sending cookies
  };

  // Enable CORS first to allow credentials, then CSRF
  app.enableCors(options);

  // Use cookie-parser before CSRF middleware
  app.use(cookieParser());

  // CSRF Protection Middleware Configuration
  app.use(
    csurf({
      cookie: {
        httpOnly: true, // Ensures cookie is not accessible via JavaScript
      },
    }),
  );

  // Global pipes for validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  // Set API prefix
  app.setGlobalPrefix('api/v1');

  // Enable shutdown hooks
  app.enableShutdownHooks();

  // Global filters for Prisma exceptions
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));
  app.useGlobalFilters(new PrismaClientValidationExceptionFilter(httpAdapter));

  // Start the server on the specified port
  const PORT = configService.port;
  await app.listen(PORT);
  
  logger.log(`Application is running on: ${await app.getUrl()}`);
  logger.log(`Environment: ${configService.nodeEnv}`);
}

bootstrap();
