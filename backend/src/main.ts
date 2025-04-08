

import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaClientExceptionFilter } from 'prisma-client-exception/prisma-client-exception.filter';
import { PrismaClientValidationExceptionFilter } from 'prisma-client-exception/prisma-client-validation-exception.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
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
      'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, Observe, Authorization, ngrok-skip-browser-warning',
    credentials: true,
  };
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );
  app.enableCors(options);
  app.setGlobalPrefix('api/v1');

  app.enableShutdownHooks();
  const config = new DocumentBuilder()
    .setTitle('Trace API')
    .setDescription('description')
    .setVersion('1.0.0')
    .addTag('trace')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-doc', app, document);

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PrismaClientExceptionFilter(httpAdapter));
  app.useGlobalFilters(new PrismaClientValidationExceptionFilter(httpAdapter));
  /*end*/

  const PORT = process.env.PORT || 80;
  await app.listen(PORT);
}
bootstrap();
