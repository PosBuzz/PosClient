import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Algorithm } from 'jsonwebtoken';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from 'src/config/config.service';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(
    private prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: (req: { cookies: { [x: string]: any } }) =>
        req.cookies['admin_access_token'],
      secretOrKey: configService.jwtSecret,
      algorithms: [configService.jwtAlgorithm as Algorithm],
    });
  }

  async validate(payload: JwtPayload) {
    const { sub, email } = payload;

    const admin = await this.prisma.superAdmin.findUnique({
      where: { id: sub, email },
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
      },
    });

    // A plain Error would surface as a 500; an unknown account is a 401
    if (!admin) throw new UnauthorizedException('SuperAdmin not found');

    const {
      password: _password,
      created_at: _created_at,
      updated_at: _updated_at,
      ...rest
    } = admin;

    // Extract permission actions from role
    const permissions = admin.role.permissions.map(
      (rp) => rp.permission.action,
    );

    return {
      ...rest,
      permissions, // attach permissions to request.user
      role: admin.role.name,
    };
  }
}
