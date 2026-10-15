import { HttpAdapterHost } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response, NextFunction } from 'express';
import { PrismaClientExceptionFilter } from 'prisma-client-exception/prisma-client-exception.filter';
import { PrismaClientValidationExceptionFilter } from 'prisma-client-exception/prisma-client-validation-exception.filter';
import { PrismaClientUnknownRequestExceptionFilter } from 'prisma-client-exception/prisma-client-unknown-request-exception.filter';
import { validationExceptionFactory } from './common/errors/validation-exception.factory';
import { ConfigService } from './config/config.service';

const CSRF_COOKIE_NAME = 'csrf_signature';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function signCsrfToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('base64url');
}

function secureCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function createCsrfToken(secret: string): { token: string; signature: string } {
  const token = randomBytes(32).toString('base64url');

  return {
    token,
    signature: signCsrfToken(token, secret),
  };
}

/**
 * Whether a browser Origin header matches the configured allow-list: an exact
 * match, or a wildcard entry such as `https://*.example.com` where `*` stands for
 * exactly one DNS label.
 */
export function isOriginAllowed(
  origin: string,
  allowedOrigins: string[],
): boolean {
  return allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === origin) return true;
    if (!allowedOrigin.includes('*')) return false;
    // Escape special regex characters except *, then let * match one label.
    const pattern = allowedOrigin
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '[a-zA-Z0-9-]+');
    return new RegExp(`^${pattern}$`).test(origin);
  });
}

export function configureApp(
  app: NestExpressApplication,
  configService: ConfigService,
): void {
  const logger = new Logger('Bootstrap');
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          connectSrc: ["'self'", ...configService.corsOrigins],
          fontSrc: ["'self'", 'https:', 'data:'],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          upgradeInsecureRequests: configService.isProduction ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // A browser origin that is not on the allow-list gets a clean 403 in the standard
  // error shape (before this, the cors library turned it into an unexplained 500).
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && !isOriginAllowed(origin, configService.corsOrigins)) {
      logger.warn(`CORS: Origin ${origin} not allowed`);
      res.status(403).json({
        statusCode: 403,
        message: 'Origin not allowed.',
        error: 'Forbidden',
      });
      return;
    }
    next();
  });

  // Dynamic CORS Configuration for multi-tenant subdomains
  const options = {
    origin: (
      origin: string,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Requests with no origin (mobile apps, curl) are allowed; any other origin
      // reaching this point already passed the 403 check above.
      callback(
        null,
        !origin || isOriginAllowed(origin, configService.corsOrigins),
      );
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

  // Signed double-submit CSRF protection.
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.csrfToken = () => {
      const { token, signature } = createCsrfToken(configService.csrfSecret);

      res.cookie(CSRF_COOKIE_NAME, signature, {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
      });

      return token;
    };

    // Exclude public endpoints from CSRF protection
    const publicPaths = ['/api/v1/public'];
    const isPublicPath = publicPaths.some((path) => req.path.startsWith(path));

    if (isPublicPath || SAFE_METHODS.has(req.method)) {
      return next();
    }

    const csrfToken = req.get(CSRF_HEADER_NAME);
    const csrfSignature = req.cookies?.[CSRF_COOKIE_NAME];

    if (!csrfToken || !csrfSignature) {
      return res.status(403).json({ message: 'invalid csrf token' });
    }

    const expectedSignature = signCsrfToken(
      csrfToken,
      configService.csrfSecret,
    );

    if (!secureCompare(csrfSignature, expectedSignature)) {
      return res.status(403).json({ message: 'invalid csrf token' });
    }

    return next();
  });

  // Global pipes for validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      // One readable message (plus per-field `errors`) instead of a raw array
      exceptionFactory: validationExceptionFactory,
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
  app.useGlobalFilters(
    new PrismaClientUnknownRequestExceptionFilter(httpAdapter),
  );
}
