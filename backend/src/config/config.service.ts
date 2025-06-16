import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService) {}

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV') || 'development';
  }

  get port(): number {
    return this.configService.get<number>('PORT') || 8000;
  }

  get jwtSecret(): string {
    return (
      this.configService.get<string>('JWT_SECRET_KEY') ||
      'REDACTED_SECRET'
    );
  }

  get jwtAlgorithm(): string {
    return this.configService.get<string>('JWT_ALGORITHM') || 'HS256';
  }

  get jwtExpiration(): string {
    return this.configService.get<string>('JWT_EXPIRATION') || '15m';
  }

  get jwtRefreshExpiration(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRATION') || '7d';
  }

  get databaseUrl(): string {
    const url = this.configService.get<string>('DATABASE_URL');
    if (!url) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }
    return url;
  }

  // Database configuration
  get dbHost(): string {
    return this.configService.get<string>('DB_HOST') || 'localhost';
  }

  get dbPort(): number {
    return this.configService.get<number>('DB_PORT') || 5432;
  }

  get dbUsername(): string {
    const username = this.configService.get<string>('DB_USERNAME');
    if (!username) {
      throw new Error('DB_USERNAME is not defined in environment variables');
    }
    return username;
  }

  get dbPassword(): string {
    const password = this.configService.get<string>('DB_PASSWORD');
    if (!password) {
      throw new Error('DB_PASS is not defined in environment variables');
    }
    return password;
  }

  get dbName(): string {
    const name = this.configService.get<string>('DB_NAME');
    if (!name) {
      throw new Error('DB_NAME is not defined in environment variables');
    }
    return name;
  }

  // Redis configuration
  get redisHost(): string {
    return this.configService.get<string>('REDIS_HOST') || 'localhost';
  }

  get redisPort(): number {
    return this.configService.get<number>('REDIS_PORT') || 6379;
  }
  get redisPrefix(): string {
    return this.configService.get<string>('REDIS_PREFIX') || 'posbuzz';
  }

  get cacheTtl(): number {
    return this.configService.get<number>('CACHE_TTL') || 3600; // Default: 1 hour in seconds
  }

  // CORS settings
  get corsOrigins(): string[] {
    const origins = this.configService.get<string>('CORS_ORIGINS');
    return origins
      ? origins.split(',')
      : [
          'http://localhost:3001',
          'http://localhost:3000',
          'http://localhost:5173',
        ];
  }

  get rabbitMQUrl(): string {
    return (
      this.configService.get<string>('RABBITMQ_URL') || 'amqp://localhost:5672'
    );
  }

  get fastApiUrl(): string {
    // Make sure this doesn't end with a trailing slash
    const url = this.configService.get<string>('FASTAPI_URL');
    if (!url) {
      throw new Error('FASTAPI_URL is not defined in environment variables');
    }

    // Remove trailing slash if present
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  // Postgres binaries paths
  get pgDumpPath(): string {
    return (
      this.configService.get<string>('PG_DUMP_PATH') ||
      'C:\\Users\\istia\\AppData\\Local\\com.tinyapp.DBngin\\Binaries\\postgresql\\17.0\\bin\\pg_dump.exe'
    );
  }

  get psqlPath(): string {
    return (
      this.configService.get<string>('PSQL_PATH') ||
      'C:\\Users\\istia\\AppData\\Local\\com.tinyapp.DBngin\\Binaries\\postgresql\\17.0\\bin\\psql.exe'
    );
  }
}
