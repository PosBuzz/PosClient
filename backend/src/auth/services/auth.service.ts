import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async loginSuperAdmin(superAdmin: { email: string; id: string }) {
    const payload = { email: superAdmin.email, sub: superAdmin.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async loginUser(user: { email: string; id: string; consumer_id: string }) {
    const payload = {
      email: user.email,
      sub: user.id,
      consumer_id: user.consumer_id,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async validateSuperAdmin(email: string, pass: string): Promise<any> {
    const superAdmin = await this.prisma.superAdmin.findUnique({
      where: { email },
    });

    if (superAdmin && (await bcrypt.compare(pass, superAdmin.password))) {
      return superAdmin;
    }

    return null;
  }

  async validateUser(email: string, pass: string): Promise<any> {
    // Find user in the database by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Verify password here (you should hash passwords in a real app)
    if (user && (await bcrypt.compare(pass, user.password))) {
      return user;
    }

    return null;
  }
}
