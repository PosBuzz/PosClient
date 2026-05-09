import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
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
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: (req: { cookies: { [x: string]: any } }) =>
        req.cookies['client_access_token'],
      secretOrKey: configService.jwtSecret,
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

    if (!user) throw new Error('Client user not found');

    const {
      password,
      created_at,
      updated_at,
      consumer,
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
      consumer_subdomain: consumer_subdomain || user.consumer.subdomain, // Use from JWT or fallback to DB
      branches, // attach branch access to request.user
    };
  }
}
