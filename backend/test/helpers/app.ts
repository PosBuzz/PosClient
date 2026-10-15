import { Test } from '@nestjs/testing';
import { InjectionToken } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../../src/app.setup';
import { ConfigService } from '../../src/config/config.service';
import { PrismaService } from '../../src/prisma/prisma.service';

export async function createTestApp(opts?: {
  overrides?: [InjectionToken, unknown][];
}) {
  // Import only after setupFiles / optional-infrastructure tests set their flags.
  const { AppModule } = await import('../../src/app.module');
  const builder = Test.createTestingModule({ imports: [AppModule] });
  for (const [token, value] of opts?.overrides ?? []) {
    builder.overrideProvider(token).useValue(value);
  }
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    rawBody: true,
  });
  app.useLogger(false);
  configureApp(app, app.get(ConfigService));
  try {
    await app.init();
    return { app, moduleRef, prisma: app.get(PrismaService) };
  } catch (error) {
    await app.close();
    throw error;
  }
}
