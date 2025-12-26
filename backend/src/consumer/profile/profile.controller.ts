import { Body, Controller, Patch, Req, UseGuards } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { ConsumerPermission } from 'src/auth/enums/consumerPermissions.enum';
import { Request } from 'express';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.companyProfile])
@Controller('consumer/profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Patch('update')
  updateProfile(@Req() req: Request, @Body() body: any) {
    const consumerId = Number(req.user?.consumer_id);
    return this.profileService.updateProfile(consumerId, body);
  }
}
