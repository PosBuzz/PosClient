import { Module } from '@nestjs/common';

import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtAdminStrategy } from './admin.jwt.strategy';
import { JwtClientStrategy } from './client.jwt.strategy';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET_KEY,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [AuthService, JwtAdminStrategy, JwtClientStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
