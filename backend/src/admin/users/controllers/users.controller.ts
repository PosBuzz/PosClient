import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { CreateSuperAdminRoleDto } from '../dtos/create-role.dto';
import { CreateSuperAdminUserDto } from '../dtos/create-user.dto';
import { AdminPermission } from 'src/auth/enums/adminPermissions.enum';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { AdminAuthGuard } from 'src/auth/guards/admin.auth.guard';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { UpdateSuperAdminRoleDto } from '../dtos/update-role.dto';
import { UpdateSuperAdminUserDto } from '../dtos/update-user.dto';
import { Request } from 'express';

@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @HasPermissions([AdminPermission.profile])
  @Patch('change-password')
  changePassword(
    @Req() req: Request,
    @Body('old_password') old_password: string,
    @Body('new_password') new_password: string,
  ) {
    return this.usersService.changePassword(
      Number(req.user?.id),
      old_password,
      new_password,
    );
  }

  @HasPermissions([AdminPermission.users])
  @Post()
  createUser(@Body() dto: CreateSuperAdminUserDto) {
    return this.usersService.createUser(dto);
  }

  @HasPermissions([AdminPermission.users])
  @Patch(':id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSuperAdminUserDto,
  ) {
    return this.usersService.updateUser(id, dto);
  }

  @HasPermissions([AdminPermission.users])
  @Post('roles')
  createRole(@Body() dto: CreateSuperAdminRoleDto) {
    return this.usersService.createRole(dto);
  }

  @HasPermissions([AdminPermission.users])
  @Patch('roles/:id')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSuperAdminRoleDto,
  ) {
    return this.usersService.updateRole(id, dto);
  }
}
