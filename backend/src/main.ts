import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import * as csurf from 'csurf';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClientExceptionFilter } from 'prisma-client-exception/prisma-client-exception.filter';
import { PrismaClientValidationExceptionFilter } from 'prisma-client-exception/prisma-client-validation-exception.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // CORS Configuration for credentials and allowed origins
  const options = {
    origin: [
      'http://localhost:3001',
      'http://localhost:3000',
      'http://localhost:5173',
    ],
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

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Trace API')
    .setDescription('description')
    .setVersion('1.0.0')
    .addTag('trace')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-doc', app, document);

  // Global filters for Prisma exceptions
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));
  app.useGlobalFilters(new PrismaClientValidationExceptionFilter(httpAdapter));

  // Start the server on the specified port
  const PORT = process.env.PORT || 80;
  await app.listen(PORT);
}

bootstrap();
