import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as dayjs from 'dayjs';
import { ConfigService } from 'src/config/config.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async loginSuperAdmin(superAdmin: { email: string; id: number }) {
    try {
      const payload = { email: superAdmin.email, sub: superAdmin.id };
      const refreshToken = this.jwtService.sign(payload, {
        expiresIn: this.configService.jwtRefreshExpiration, // Refresh token validity
      });

      // Save refresh token in the database
      await this.prisma.superAdmin.update({
        where: { id: superAdmin.id },
        data: { refresh_token: refreshToken },
      });

      return {
        access_token: this.jwtService.sign(payload, {
          expiresIn: this.configService.jwtExpiration,
        }),
        refresh_token: refreshToken,
      };
    } catch (error) {
      this.logger.error(
        `Error occurred while logging in super admin for ${superAdmin.email}`,
        error.stack,
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
      const refreshToken = this.jwtService.sign(payload, {
        expiresIn: this.configService.jwtRefreshExpiration, // Refresh token validity
      });

      // Save refresh token in the database
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refresh_token: refreshToken },
      });

      return {
        access_token: this.jwtService.sign(payload, {
          expiresIn: this.configService.jwtExpiration,
        }),
        refresh_token: refreshToken,
      };
    } catch (error) {
      this.logger.error(
        `Error occurred while logging in user for ${user.email}`,
        error.stack,
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

      if (!superAdmin) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      if (!(await bcrypt.compare(pass, superAdmin.password))) {
        throw new HttpException("Password doesn't match", HttpStatus.FORBIDDEN);
      }
      return superAdmin;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error occurred while validating super admin for ${email}`,
        error.stack,
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
      const user = await this.prisma.user.findFirst({
        where: {
          email,
          consumer: {
            subdomain,
          },
        },
        include: {
          consumer: {
            select: {
              subdomain: true,
              billing_logs: {
                where: {
                  billing_date: {
                    gte: dayjs().subtract(1, 'month').startOf('day').toDate(),
                    lte: dayjs().endOf('day').toDate(),
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      if (!user.consumer.billing_logs.length) {
        throw new HttpException('Billing cycle failed', HttpStatus.FORBIDDEN);
      }
      if (!(await bcrypt.compare(pass, user.password))) {
        throw new HttpException("Password doesn't match", HttpStatus.FORBIDDEN);
      }

      return user;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Error occurred while validating user for ${email}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to validate user',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async clientRefreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);

      // Validate refresh token in the database
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub, refresh_token: refreshToken },
        include: {
          consumer: {
            select: {
              subdomain: true,
            },
          },
        },
      });

      if (!user) {
        throw new Error('Invalid refresh token');
      }

      const newAccessToken = this.jwtService.sign(
        {
          email: payload.email,
          sub: payload.sub,
          consumer_id: payload.consumer_id,
          consumer_subdomain: user.consumer.subdomain,
        },
        { expiresIn: this.configService.jwtExpiration },
      );

      return { access_token: newAccessToken };
    } catch (error) {
      this.logger.error(
        `Error occurred while refreshing client token for refresh token ${refreshToken}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to refresh client token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async adminRefreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);

      // Validate refresh token in the database
      const user = await this.prisma.superAdmin.findUnique({
        where: { id: payload.sub, refresh_token: refreshToken },
      });

      if (!user) {
        throw new Error('Invalid refresh token');
      }

      const newAccessToken = this.jwtService.sign(
        {
          email: payload.email,
          sub: payload.sub,
        },
        { expiresIn: this.configService.jwtExpiration },
      );

      return { access_token: newAccessToken };
    } catch (error) {
      this.logger.error(
        `Error occurred while refreshing admin token for refresh token ${refreshToken}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to refresh admin token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async invalidateAdminRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.decode(refreshToken) as { sub: number };

      if (!payload) {
        throw new Error('Invalid refresh token');
      }

      // Invalidate the refresh token in the database
      await this.prisma.superAdmin.updateMany({
        where: { id: payload.sub, refresh_token: refreshToken },
        data: { refresh_token: null },
      });
    } catch (error) {
      this.logger.error(
        `Error occurred while invalidating admin refresh token for refresh token ${refreshToken}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to invalidate admin refresh token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async invalidateClientRefreshToken(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.decode(refreshToken) as { sub: number };

      if (!payload) {
        throw new Error('Invalid refresh token');
      }

      // Invalidate the refresh token in the database
      await this.prisma.user.updateMany({
        where: { id: payload.sub, refresh_token: refreshToken },
        data: { refresh_token: null },
      });
    } catch (error) {
      this.logger.error(
        `Error occurred while invalidating client refresh token for refresh token ${refreshToken}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to invalidate client refresh token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
