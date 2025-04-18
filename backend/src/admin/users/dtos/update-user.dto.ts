import { PartialType } from '@nestjs/mapped-types';
import { CreateSuperAdminUserDto } from './create-user.dto';

export class UpdateSuperAdminUserDto extends PartialType(CreateSuperAdminUserDto) {}
