import {
  Body,
  Controller,
  Post,
  Res,
  Req,
  UseGuards,
  Get,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { Response, Request } from 'express';

import { AuthGuard } from '../guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login-superadmin')
  async loginSuperAdmin(@Body() loginDto: LoginDto, @Res() res: Response) {
    const superAdmin = await this.authService.validateSuperAdmin(
      loginDto.email,
      loginDto.password,
    );

    const { access_token, refresh_token } =
      await this.authService.loginSuperAdmin(superAdmin);

    res.cookie('access_token', access_token, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    }); // 15 minutes
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }); // 7 days

    return res.send({ message: 'Login successful' });
  }

  @Post('login-user')
  async loginUser(@Body() loginDto: LoginDto, @Res() res: Response) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );

    const { access_token, refresh_token } =
      await this.authService.loginUser(user);

    res.cookie('access_token', access_token, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    }); // 15 minutes
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }); // 7 days

    return res.send({ message: 'Login successful' });
  }

  @Post('refresh-token')
async refreshToken(@Req() req: Request, @Res() res: Response) {
  const refreshToken = req.cookies['refresh_token'];

  if (!refreshToken) {
    // If refresh token is not found, clear cookies and log the user out
    res.clearCookie('access_token', { httpOnly: true });
    res.clearCookie('refresh_token', { httpOnly: true });
    return res.status(401).send({ message: 'Refresh token not found. Logged out successfully.' });
  }

  try {
    const { access_token } = await this.authService.refreshToken(refreshToken);

    // If refresh token is expired or invalid
    if (!access_token) {
      res.clearCookie('access_token', { httpOnly: true });
      res.clearCookie('refresh_token', { httpOnly: true });
      return res.status(401).send({ message: 'Refresh token expired. Please log in again.' });
    }

    res.cookie('access_token', access_token, { httpOnly: true, maxAge: 15 * 60 * 1000 }); // 15 minutes
    return res.send({ message: 'Token refreshed' });
  } catch (error) {
    res.clearCookie('access_token', { httpOnly: true });
    res.clearCookie('refresh_token', { httpOnly: true });
    return res.status(401).send({ message: 'Invalid refresh token or expired session.' });
  }
}


  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies['refresh_token'];

    if (refreshToken) {
      await this.authService.invalidateRefreshToken(refreshToken);
    }

    // Clear the cookies
    res.clearCookie('access_token', { httpOnly: true });
    res.clearCookie('refresh_token', { httpOnly: true });

    return res.send({ message: 'Logout successful' });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req: Request) {
    const user = req.user; // The user object is attached by the AuthGuard
    return user;
  }
}
