import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtClientStrategy extends PassportStrategy(
  Strategy,
  'jwt-client',
) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: (req: { cookies: { [x: string]: any } }) =>
        req.cookies['client_access_token'],
      secretOrKey: process.env.JWT_SECRET_KEY || 'default_secret_key',
    });
  }

  async validate(payload: JwtPayload) {
    const { sub, consumer_id } = payload;

    const user = await this.prisma.user.findUnique({
      where: { id: sub, consumer_id },
    });

    if (!user) throw new Error('Client user not found');

    const { password, created_at, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
