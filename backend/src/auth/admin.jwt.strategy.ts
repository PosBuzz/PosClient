import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: (req: { cookies: { [x: string]: any } }) =>
        req.cookies['admin_access_token'],
      secretOrKey: process.env.JWT_SECRET_KEY || 'default_secret_key',
    });
  }

  async validate(payload: JwtPayload) {
    const { sub, email } = payload;

    const admin = await this.prisma.superAdmin.findUnique({
      where: { id: sub, email },
    });

    if (!admin) throw new Error('SuperAdmin not found');

    const { password, created_at, ...adminWithoutPassword } = admin;
    return adminWithoutPassword;
  }
}
