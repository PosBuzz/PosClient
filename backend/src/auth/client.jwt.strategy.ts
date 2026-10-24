import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Algorithm } from 'jsonwebtoken';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from 'src/config/config.service';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtClientStrategy extends PassportStrategy(
  Strategy,
  'jwt-client',
) {
  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: (req: { cookies: { [x: string]: any } }) =>
        req.cookies['client_access_token'],
      secretOrKey: configService.jwtSecret,
      algorithms: [configService.jwtAlgorithm as Algorithm],
    });
  }

  async validate(payload: JwtPayload) {
    const { sub, consumer_id, consumer_subdomain } = payload;

    const user = await this.prisma.user.findUnique({
      where: { id: sub, consumer_id },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        consumer: true,
        branches: {
          include: {
            branch: true,
          },
        },
      },
    });

    // A plain Error would surface as a 500; an unknown account is a 401
    if (!user) throw new UnauthorizedException('Client user not found');

    // Soft-deleted tenants cannot log in (see AuthService.validateUser), and
    // sessions issued before the deletion must stop working too
    if (user.consumer.deleted_at) {
      throw new UnauthorizedException('This account is no longer active');
    }

    const {
      password: _password,
      refresh_token: _refreshToken,
      created_at: _created_at,
      updated_at: _updated_at,
      consumer: _consumer,
      ...userWithoutPassword
    } = user;

    // Extract permission actions from role
    const permissions = user.role.permissions.map((rp) => rp.permission.action);

    // Extract branch information
    const branches = user.branches.map((ub) => ({
      id: ub.branch.id,
      name: ub.branch.name,
      is_main: ub.branch.is_main,
      is_warehouse: ub.branch.is_warehouse,
    }));

    return {
      ...userWithoutPassword,
      permissions, // attach permissions to request.user
      role: user.role.name,
      plan_id: user.consumer.plan_id,
      company_name: user.consumer.company_name,
      company_email: user.consumer.email,
      secondary_email: user.consumer.secondary_email,
      phone: user.consumer.phone,
      address: user.consumer.address,
      logo: user.consumer.logo,
      logo_icon: user.consumer.logo_icon,
      consumer_subdomain: consumer_subdomain || user.consumer.subdomain, // Use from JWT or fallback to DB
      branches, // attach branch access to request.user
    };
  }
}
