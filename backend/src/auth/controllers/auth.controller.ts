import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CookieOptions, Request, Response } from 'express';

// Extend the Request interface to include csrfToken
import { LoginDto } from '../dto/login.dto';
import { AdminAuthGuard } from '../guards/admin.auth.guard';
import { ClientAuthGuard } from '../guards/client.auth.guard';
import { LoginThrottlerGuard } from '../guards/login-throttler.guard';
import { AuthService } from '../services/auth.service';
import { Throttle } from '@nestjs/throttler';
import { SubdomainUtilService } from 'src/common/services/subdomain-util.service';

const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'none',
  secure: true,
};

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private subdomainUtil: SubdomainUtilService,
  ) {}

  @Get('csrf-token')
  getCsrfToken(@Req() req: Request, @Res() res: Response): void {
    res.json({ csrfToken: req.csrfToken() });
  }

  private setAuthCookie(
    res: Response,
    name: string,
    value: string,
    maxAge: number,
  ) {
    res.cookie(name, value, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge,
    });
  }

  private clearAuthCookie(res: Response, name: string) {
    res.clearCookie(name, AUTH_COOKIE_OPTIONS);
  }

  private clearAdminCookies(res: Response) {
    this.clearAuthCookie(res, 'admin_access_token');
    this.clearAuthCookie(res, 'admin_refresh_token');
  }

  private clearClientCookies(res: Response) {
    this.clearAuthCookie(res, 'client_access_token');
    this.clearAuthCookie(res, 'client_refresh_token');
  }

  @UseGuards(LoginThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login-superadmin')
  async loginSuperAdmin(@Body() loginDto: LoginDto, @Res() res: Response) {
    const superAdmin = await this.authService.validateSuperAdmin(
      loginDto.email,
      loginDto.password,
    );

    const { access_token, refresh_token } =
      await this.authService.loginSuperAdmin(superAdmin);

    this.setAuthCookie(res, 'admin_access_token', access_token, 15 * 60 * 1000);
    this.setAuthCookie(
      res,
      'admin_refresh_token',
      refresh_token,
      7 * 24 * 60 * 60 * 1000,
    );

    return res.send({ message: 'Login successful' });
  }

  @UseGuards(LoginThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login-user')
  async loginUser(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // Extract subdomain from Origin header
    const origin = req.headers.origin || req.headers.referer;

    if (!origin) {
      return res.status(400).send({
        message: 'Unable to determine subdomain from request',
      });
    }

    // Extract subdomain from origin URL using centralized utility
    const subdomain = this.subdomainUtil.extractSubdomainFromUrl(origin);

    if (!subdomain) {
      return res.status(400).send({
        message:
          'No valid subdomain found. Please access via tenant subdomain.',
      });
    }

    // Validate user credentials
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
      subdomain,
    );

    // Validate user belongs to the subdomain they're trying to access
    if (user.consumer.subdomain !== subdomain) {
      return res.status(403).send({
        message: 'Invalid credentials for this tenant',
      });
    }

    const { access_token, refresh_token } = await this.authService.loginUser({
      email: user.email,
      id: user.id,
      consumer_id: user.consumer_id,
      consumer_subdomain: user.consumer.subdomain,
    });

    this.setAuthCookie(
      res,
      'client_access_token',
      access_token,
      15 * 60 * 1000,
    );
    this.setAuthCookie(
      res,
      'client_refresh_token',
      refresh_token,
      7 * 24 * 60 * 60 * 1000,
    );

    return res.send({
      access_token,
      message: 'Login successful',
    });
  }

  @Post('admin-refresh-token')
  async adminRefreshToken(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies['admin_refresh_token'];

    if (!refreshToken) {
      // If refresh token is not found, clear cookies and log the user out
      this.clearAdminCookies(res);
      return res
        .status(401)
        .send({ message: 'Refresh token not found. Logged out successfully.' });
    }

    try {
      const { access_token, refresh_token: newRefreshToken } =
        await this.authService.adminRefreshToken(refreshToken);

      this.setAuthCookie(
        res,
        'admin_access_token',
        access_token,
        15 * 60 * 1000,
      );
      this.setAuthCookie(
        res,
        'admin_refresh_token',
        newRefreshToken,
        7 * 24 * 60 * 60 * 1000,
      );
      return res.send({ message: 'Token refreshed' });
    } catch {
      this.clearAdminCookies(res);
      return res
        .status(401)
        .send({ message: 'Invalid refresh token or expired session.' });
    }
  }

  @Post('client-refresh-token')
  async clientRefreshToken(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies['client_refresh_token'];

    if (!refreshToken) {
      // If refresh token is not found, clear cookies and log the user out
      this.clearClientCookies(res);
      return res
        .status(401)
        .send({ message: 'Refresh token not found. Logged out successfully.' });
    }

    try {
      const { access_token, refresh_token: newRefreshToken } =
        await this.authService.clientRefreshToken(refreshToken);

      this.setAuthCookie(
        res,
        'client_access_token',
        access_token,
        15 * 60 * 1000,
      );
      this.setAuthCookie(
        res,
        'client_refresh_token',
        newRefreshToken,
        7 * 24 * 60 * 60 * 1000,
      );
      return res.send({ message: 'Token refreshed' });
    } catch {
      this.clearClientCookies(res);
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

    this.clearClientCookies(res);

    return res.send({ message: 'Logout successful' });
  }

  @Post('admin-logout')
  async adminLogout(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies['admin_refresh_token'];

    if (refreshToken) {
      await this.authService.invalidateAdminRefreshToken(refreshToken);
    }

    this.clearAdminCookies(res);

    return res.send({ message: 'Logout successful' });
  }

  @Get('client')
  @UseGuards(ClientAuthGuard)
  getClientMe(@Req() req: Request) {
    return { user: req.user };
  }

  @Get('admin')
  @UseGuards(AdminAuthGuard)
  getAdminMe(@Req() req: Request) {
    return { user: req.user };
  }
}
