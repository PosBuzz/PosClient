import { SetMetadata } from '@nestjs/common';
import { AdminPermission } from 'src/auth/enums/adminPermissions.enum';

export const HasPermissions = (permissions: AdminPermission[]) =>
  SetMetadata('permissions', permissions);
