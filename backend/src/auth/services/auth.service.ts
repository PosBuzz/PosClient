import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Algorithm } from 'jsonwebtoken';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { createHmac } from 'crypto';
import { ConfigService } from 'src/config/config.service';
import { errorStack } from '../../common/utils/error.util';
import { isClientError } from '../../common/errors/client-error';

// One message for "no such account" and "wrong password", so the login form
// cannot be used to find out which emails are registered.
const INVALID_CREDENTIALS = 'Invalid email or password';

// Compared against when the account does not exist, so an unknown email takes
// as long as a wrong password (cost matches the hashes the app stores).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('posbuzz-timing-equalizer', 10);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private get jwtAlgorithm(): Algorithm {
    return this.configService.jwtAlgorithm as Algorithm;
  }

  private signToken(
    payload: Record<string, unknown>,
    expiresIn: string,
  ): string {
    return this.jwtService.sign(payload, {
      expiresIn,
      algorithm: this.jwtAlgorithm,
    });
  }

  private verifyToken(refreshToken: string) {
    return this.jwtService.verify(refreshToken, {
      algorithms: [this.jwtAlgorithm],
    });
  }

  private hashRefreshToken(refreshToken: string): string {
    const digest = createHmac('sha256', this.configService.jwtSecret)
      .update(refreshToken)
      .digest('base64url');

    return `sha256:${digest}`;
  }

  async loginSuperAdmin(superAdmin: { email: string; id: number }) {
    try {
      const payload = { email: superAdmin.email, sub: superAdmin.id };
      const refreshToken = this.signToken(
        payload,
        this.configService.jwtRefreshExpiration,
      );

      // Save refresh token in the database
      await this.prisma.superAdmin.update({
        where: { id: superAdmin.id },
        data: { refresh_token: this.hashRefreshToken(refreshToken) },
      });

      return {
        access_token: this.signToken(payload, this.configService.jwtExpiration),
        refresh_token: refreshToken,
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error occurred while logging in super admin for ${superAdmin.email}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to login super admin',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async loginUser(user: {
    email: string;
    id: number;
    consumer_id: number;
    consumer_subdomain: string;
  }) {
    try {
      const payload = {
        email: user.email,
        sub: user.id,
        consumer_id: user.consumer_id,
        consumer_subdomain: user.consumer_subdomain,
      };
      const refreshToken = this.signToken(
        payload,
        this.configService.jwtRefreshExpiration,
      );

      // Save refresh token in the database
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refresh_token: this.hashRefreshToken(refreshToken) },
      });

      return {
        access_token: this.signToken(payload, this.configService.jwtExpiration),
        refresh_token: refreshToken,
      };
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        `Error occurred while logging in user for ${user.email}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to login user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async validateSuperAdmin(email: string, pass: string): Promise<any> {
    try {
      const superAdmin = await this.prisma.superAdmin.findUnique({
        where: { email },
      });

      const passwordMatches = await bcrypt.compare(
        pass,
        superAdmin?.password ?? DUMMY_PASSWORD_HASH,
      );
      if (!superAdmin || !passwordMatches) {
        throw new UnauthorizedException(INVALID_CREDENTIALS);
      }
      return superAdmin;
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error occurred while validating super admin for ${email}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to validate super admin',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async validateUser(
    email: string,
    pass: string,
    subdomain: string,
  ): Promise<any> {
    try {
      const now = new Date();
      const user = await this.prisma.user.findFirst({
        where: {
          email,
          consumer: {
            subdomain,
            // Soft-deleted tenants cannot be logged into.
            deleted_at: null,
          },
        },
        include: {
          consumer: {
            select: {
              subdomain: true,
              billing_logs: {
                where: {
                  billing_from: { lte: now },
                  billing_till: { gte: now },
                },
              },
            },
          },
        },
      });

      const passwordMatches = await bcrypt.compare(
        pass,
        user?.password ?? DUMMY_PASSWORD_HASH,
      );
      if (!user || !passwordMatches) {
        throw new UnauthorizedException(INVALID_CREDENTIALS);
      }

      // Checked only after the password, so subscription state is never
      // revealed to someone without valid credentials
      if (!user.consumer.billing_logs.length) {
        throw new HttpException(
          'Your subscription is not active. Please renew it or contact support to continue.',
          HttpStatus.FORBIDDEN,
        );
      }

      return user;
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        `Error occurred while validating user for ${email}`,
        errorStack(error),
      );
      throw new HttpException(
        'Failed to validate user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async clientRefreshToken(refreshToken: string) {
    try {
      const payload = this.verifyToken(refreshToken);
      const refreshTokenHash = this.hashRefreshToken(refreshToken);

      // Validate refresh token in the database
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          OR: [
            { refresh_token: refreshTokenHash },
            { refresh_token: refreshToken },
          ],
        },
        include: {
          consumer: {
            select: {
              subdomain: true,
              deleted_at: true,
            },
          },
        },
      });

      if (!user) {
        throw new HttpException(
          'Invalid refresh token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      // Stop refreshing sessions for a soft-deleted tenant. Access tokens
      // already issued stay valid until they expire (JWT_EXPIRATION).
      if (user.consumer?.deleted_at) {
        throw new HttpException(
          'This account is no longer active',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const tokenPayload = {
        email: payload.email,
        sub: payload.sub,
        consumer_id: payload.consumer_id,
        consumer_subdomain: user.consumer.subdomain,
      };
      const currentRefreshToken = user.refresh_token;

      // Token rotation: issue a new refresh token and invalidate the old one.
      const newRefreshToken = this.signToken(
        tokenPayload,
        this.configService.jwtRefreshExpiration,
      );

      // Atomic compare-and-swap: only the request that still holds the current
      // refresh token can rotate it. Concurrent losers will get count=0.
      const rotateResult = await this.prisma.user.updateMany({
        where: { id: user.id, refresh_token: currentRefreshToken },
        data: { refresh_token: this.hashRefreshToken(newRefreshToken) },
      });

      if (rotateResult.count !== 1) {
        throw new HttpException(
          'Refresh token already rotated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const newAccessToken = this.signToken(
        tokenPayload,
        this.configService.jwtExpiration,
      );

      return { access_token: newAccessToken, refresh_token: newRefreshToken };
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        'Error occurred while refreshing client token',
        errorStack(error),
      );
      throw new HttpException(
        'Failed to refresh client token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async adminRefreshToken(refreshToken: string) {
    try {
      const payload = this.verifyToken(refreshToken);
      const refreshTokenHash = this.hashRefreshToken(refreshToken);

      // Validate refresh token in the database
      const user = await this.prisma.superAdmin.findFirst({
        where: {
          id: payload.sub,
          OR: [
            { refresh_token: refreshTokenHash },
            { refresh_token: refreshToken },
          ],
        },
      });

      if (!user) {
        throw new HttpException(
          'Invalid refresh token',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const tokenPayload = { email: payload.email, sub: payload.sub };
      const currentRefreshToken = user.refresh_token;

      // Token rotation: issue a new refresh token and invalidate the old one.
      const newRefreshToken = this.signToken(
        tokenPayload,
        this.configService.jwtRefreshExpiration,
      );

      // Atomic compare-and-swap: only one concurrent refresh can succeed.
      const rotateResult = await this.prisma.superAdmin.updateMany({
        where: { id: user.id, refresh_token: currentRefreshToken },
        data: { refresh_token: this.hashRefreshToken(newRefreshToken) },
      });

      if (rotateResult.count !== 1) {
        throw new HttpException(
          'Refresh token already rotated',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const newAccessToken = this.signToken(
        tokenPayload,
        this.configService.jwtExpiration,
      );

      return { access_token: newAccessToken, refresh_token: newRefreshToken };
    } catch (error) {
      if (isClientError(error)) throw error;
      this.logger.error(
        'Error occurred while refreshing admin token',
        errorStack(error),
      );
      throw new HttpException(
        'Failed to refresh admin token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async invalidateAdminRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.decode(refreshToken);

      if (!payload) {
        throw new Error('Invalid refresh token');
      }

      // Invalidate the refresh token in the database
      await this.prisma.superAdmin.updateMany({
        where: {
          id: payload.sub,
          OR: [
            { refresh_token: this.hashRefreshToken(refreshToken) },
            { refresh_token: refreshToken },
          ],
        },
        data: { refresh_token: null },
      });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        'Error occurred while invalidating admin refresh token',
        errorStack(error),
      );
      throw new HttpException(
        'Failed to invalidate admin refresh token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async invalidateClientRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.decode(refreshToken);

      if (!payload) {
        throw new Error('Invalid refresh token');
      }

      // Invalidate the refresh token in the database
      await this.prisma.user.updateMany({
        where: {
          id: payload.sub,
          OR: [
            { refresh_token: this.hashRefreshToken(refreshToken) },
            { refresh_token: refreshToken },
          ],
        },
        data: { refresh_token: null },
      });
    } catch (error) {
      if (isClientError(error)) {
        throw error;
      }
      this.logger.error(
        'Error occurred while invalidating client refresh token',
        errorStack(error),
      );
      throw new HttpException(
        'Failed to invalidate client refresh token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
