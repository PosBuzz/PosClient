import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import { ChangePasswordService } from './change-password.service';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { ConsumerPermission } from 'src/auth/enums/consumerPermissions.enum';
import { Request } from 'express';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';

@HasPermissions([ConsumerPermission.profile])
@UseGuards(ClientAuthGuard, PermissionsGuard)
@Controller('consumer')
export class ChangePasswordController {
  constructor(private readonly changePasswordService: ChangePasswordService) {}

  @Patch('change-password')
  changePassword(
    @Req() req: Request,
    @Body('old_password') old_password: string,
    @Body('new_password') new_password: string,
  ) {
    return this.changePasswordService.changePassword(
      Number(req.user?.id),
      old_password,
      new_password,
    );
  }
}
