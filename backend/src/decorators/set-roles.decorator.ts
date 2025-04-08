import { SetMetadata } from '@nestjs/common';
import { Role } from '../auth/enums/roles.enum';

export const HasRoles = (roles: Role[]) => SetMetadata('roles', roles); // Custom decorator to set roles
