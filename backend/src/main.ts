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

  // Dynamic CORS Configuration for multi-tenant subdomains
  const options = {
    origin: (
      origin: string,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin matches allowed patterns
      const allowedOrigins = configService.corsOrigins;
      const isAllowed = allowedOrigins.some((allowedOrigin) => {
        // Exact match
        if (allowedOrigin === origin) return true;

        // Wildcard subdomain support (e.g., *.example.com)
        if (allowedOrigin.includes('*')) {
          const pattern = allowedOrigin.replace(/\*/g, '[a-zA-Z0-9-]+');
          const regex = new RegExp(`^${pattern}$`);
          return regex.test(origin);
        }

        return false;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`CORS: Origin ${origin} not allowed`);
        callback(new Error('Not allowed by CORS'));
      }
    },
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
        sameSite: 'none',
        secure: true,
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
  logger.log(`CORS Origins: ${configService.corsOrigins.join(', ')}`);
}

bootstrap();
