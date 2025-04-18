import { PartialType } from '@nestjs/mapped-types';
import { CreateSuperAdminRoleDto } from './create-role.dto';

export class UpdateSuperAdminRoleDto extends PartialType(CreateSuperAdminRoleDto) {}
