import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAdminStrategy } from './admin.jwt.strategy';
import { JwtClientStrategy } from './client.jwt.strategy';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.jwtSecret,
        signOptions: {
          expiresIn: configService.jwtExpiration,
          algorithm: configService.jwtAlgorithm as import('jsonwebtoken').Algorithm,
        },
      }),
    }),
  ],
  providers: [AuthService, JwtAdminStrategy, JwtClientStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
