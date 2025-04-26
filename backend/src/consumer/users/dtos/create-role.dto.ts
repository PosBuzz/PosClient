import { IsString, IsArray } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  name: string;

  @IsArray()
  permission_ids: number[];
}
