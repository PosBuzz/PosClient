import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import { ChangePasswordService } from './change-password.service';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { ConsumerPermission } from 'src/auth/enums/consumerPermissions.enum';
import { Request } from 'express';
import { ChangePasswordDto } from 'src/common/dto/change-password.dto';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';

@HasPermissions([ConsumerPermission.profile])
@UseGuards(ClientAuthGuard, PermissionsGuard)
@Controller('consumer')
export class ChangePasswordController {
  constructor(private readonly changePasswordService: ChangePasswordService) {}

  @Patch('change-password')
  changePassword(@Req() req: Request, @Body() dto: ChangePasswordDto) {
    return this.changePasswordService.changePassword(
      Number(req.user?.id),
      dto.old_password,
      dto.new_password,
    );
  }
}
