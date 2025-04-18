import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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

@HasPermissions([AdminPermission.users])
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  createUser(@Body() dto: CreateSuperAdminUserDto) {
    return this.usersService.createUser(dto);
  }

  @Patch(':id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSuperAdminUserDto,
  ) {
    return this.usersService.updateUser(id, dto);
  }
  
  @Post('roles')
  createRole(@Body() dto: CreateSuperAdminRoleDto) {
    return this.usersService.createRole(dto);
  }

  @Patch('roles/:id')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSuperAdminRoleDto,
  ) {
    return this.usersService.updateRole(id, dto);
  }
}
