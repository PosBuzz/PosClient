import { IsString, IsArray } from 'class-validator';

export class CreateSuperAdminRoleDto {
  @IsString()
  name: string;

  @IsArray()
  permission_ids: number[];
}
