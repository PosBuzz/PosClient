import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login-superadmin')
  async loginSuperAdmin(@Body() loginDto: LoginDto) {
    const superAdmin = await this.authService.validateSuperAdmin(
      loginDto.email,
      loginDto.password,
    );
    return this.authService.loginSuperAdmin(superAdmin);
  }

  @Post('login-user')
  async loginUser(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    return this.authService.loginUser(user);
  }
}
