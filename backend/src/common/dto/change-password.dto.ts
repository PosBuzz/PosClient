import { IsNotEmpty, IsString } from 'class-validator';

/** Body of the change-password endpoints (tenant users and super admins). */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  old_password: string;

  @IsString()
  @IsNotEmpty()
  new_password: string;
}
