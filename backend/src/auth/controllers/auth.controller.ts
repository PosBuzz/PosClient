import {
  Body,
  Controller,
  Post,
  Res,
  Req,
  UseGuards,
  Get,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import { Response, Request } from 'express';

import { AuthGuard } from '../guards/auth.guard';
import { Role } from '../enums/roles.enum';

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

    res.cookie('admin_access_token', access_token, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    }); // 15 minutes
    res.cookie('admin_refresh_token', refresh_token, {
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

    res.cookie('client_access_token', access_token, {
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
    }); // 15 minutes
    res.cookie('client_refresh_token', refresh_token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }); // 7 days

    return res.send({ message: 'Login successful' });
  }

  @Post('admin-refresh-token')
  async adminRefreshToken(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies['admin_refresh_token'];

    if (!refreshToken) {
      // If refresh token is not found, clear cookies and log the user out
      res.clearCookie('admin_access_token', { httpOnly: true });
      res.clearCookie('admin_refresh_token', { httpOnly: true });
      return res
        .status(401)
        .send({ message: 'Refresh token not found. Logged out successfully.' });
    }

    try {
      const { access_token } =
        await this.authService.refreshToken(refreshToken);

      // If refresh token is expired or invalid
      if (!access_token) {
        res.clearCookie('admin_access_token', { httpOnly: true });
        res.clearCookie('admin_refresh_token', { httpOnly: true });
        return res
          .status(401)
          .send({ message: 'Refresh token expired. Please log in again.' });
      }

      res.cookie('admin_access_token', access_token, {
        httpOnly: true,
        maxAge: 15 * 60 * 1000,
      }); // 15 minutes
      return res.send({ message: 'Token refreshed' });
    } catch (error) {
      res.clearCookie('admin_access_token', { httpOnly: true });
      res.clearCookie('admin_refresh_token', { httpOnly: true });
      return res
        .status(401)
        .send({ message: 'Invalid refresh token or expired session.' });
    }
  }

  @Post('client-refresh-token')
  async clientRefreshToken(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies['refresh_token'];

    if (!refreshToken) {
      // If refresh token is not found, clear cookies and log the user out
      res.clearCookie('client_access_token', { httpOnly: true });
      res.clearCookie('client_refresh_token', { httpOnly: true });
      return res
        .status(401)
        .send({ message: 'Refresh token not found. Logged out successfully.' });
    }

    try {
      const { access_token } =
        await this.authService.refreshToken(refreshToken);

      // If refresh token is expired or invalid
      if (!access_token) {
        res.clearCookie('client_access_token', { httpOnly: true });
        res.clearCookie('client_refresh_token', { httpOnly: true });
        return res
          .status(401)
          .send({ message: 'Refresh token expired. Please log in again.' });
      }

      res.cookie('client_access_token', access_token, {
        httpOnly: true,
        maxAge: 15 * 60 * 1000,
      }); // 15 minutes
      return res.send({ message: 'Token refreshed' });
    } catch (error) {
      res.clearCookie('client_access_token', { httpOnly: true });
      res.clearCookie('client_refresh_token', { httpOnly: true });
      return res
        .status(401)
        .send({ message: 'Invalid refresh token or expired session.' });
    }
  }

  @Post('client-logout')
  async clientLogout(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies['client_refresh_token'];

    if (refreshToken) {
      await this.authService.invalidateClientRefreshToken(refreshToken);
    }

    // Clear the cookies
    res.clearCookie('client_access_token', { httpOnly: true });
    res.clearCookie('client_refresh_token', { httpOnly: true });

    return res.send({ message: 'Logout successful' });
  }

  @Post('admin-logout')
  async adminLogout(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies['admin_refresh_token'];

    if (refreshToken) {
      await this.authService.invalidateAdminRefreshToken(refreshToken);
    }

    // Clear the cookies
    res.clearCookie('admin_access_token', { httpOnly: true });
    res.clearCookie('admin_refresh_token', { httpOnly: true });

    return res.send({ message: 'Logout successful' });
  }

  @Get('client')
  @UseGuards(AuthGuard)
  async getClientMe(@Req() req: Request) {
    const user = req.user;
    if (user && !('consumer_id' in user)) {
      throw new HttpException(
        'Unauthorized: Not a client',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return { role: Role.USER, user };
  }

  @Get('admin')
  @UseGuards(AuthGuard)
  async getAdminMe(@Req() req: Request) {
    const user = req.user;
    if (user && 'consumer_id' in user) {
      throw new HttpException(
        'Unauthorized: Not a client',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return { role: Role.SUPER_ADMIN, user };
  }
}
