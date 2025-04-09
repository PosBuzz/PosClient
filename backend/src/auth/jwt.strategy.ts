import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: (req: { cookies: { [x: string]: any } }) =>
        req.cookies['access_token'],
      secretOrKey: process.env.JWT_SECRET_KEY || 'default_secret_key',
    });
  }

  async validate(payload: JwtPayload) {
    const { sub, email, consumer_id } = payload;

    // Validate for User (Consumer)
    if (consumer_id) {
      const user = await this.prisma.user.findUnique({
        where: { id: sub, consumer_id: consumer_id },
      });

      if (!user) {
        throw new Error('User not found');
      }
      const { password, created_at, ...userWithoutPassword } = user
      ;
      return userWithoutPassword; // Return the found user
    }

    // Validate for SuperAdmin
    const superAdmin = await this.prisma.superAdmin.findUnique({
      where: { id: sub, email: email },
    });

    if (!superAdmin) {
      throw new Error('SuperAdmin not found');
    }

    const { password, created_at, ...superAdminWithoutPassword } = superAdmin;

    return superAdminWithoutPassword; // Return the found superAdmin without password
  }
}
