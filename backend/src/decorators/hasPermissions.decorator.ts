import { SetMetadata } from '@nestjs/common';
import { AdminPermission } from 'src/auth/enums/adminPermissions.enum';
import { ConsumerPermission } from 'src/auth/enums/consumerPermissions.enum';

export const HasPermissions = (permissions: AdminPermission[] | ConsumerPermission[]) =>
  SetMetadata('permissions', permissions);
