import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ConsumerPermission } from 'src/auth/enums/consumerPermissions.enum';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UpdateRoleDto } from '../dtos/update-role.dto';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UsersService } from '../services/users.service';

@HasPermissions([ConsumerPermission.users])
@UseGuards(ClientAuthGuard, PermissionsGuard)
@Controller('consumer/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getUsers(
    @Query('search_text') search_text: string,
    @Query('role_id') role_id: string,
    @Req() req: Request,
  ) {
    const parsedRoleId =
      role_id && role_id !== 'null' ? Number(role_id) : undefined;

    return this.usersService.getUsers(
      Number(req?.user?.consumer_id),
      search_text !== 'null' ? search_text : undefined,
      parsedRoleId,
    );
  }

  @Post()
  createUser(@Body() dto: CreateUserDto, @Req() req: Request) {
    return this.usersService.createUser(dto, Number(req?.user?.consumer_id));
  }

  @Patch(':id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, dto);
  }

  @Delete(':id')
  deleteUser(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.usersService.deleteUser(id, Number(req?.user?.consumer_id));
  }

  @Get('plan-permissions')
  permissionOptions(@Req() req: Request) {
    return this.usersService.permissionOptions(Number(req?.user?.plan_id));
  }

  @Get('roles')
  getRoles(@Req() req: Request) {
    return this.usersService.getRoles(Number(req?.user?.consumer_id));
  }

  @Post('roles')
  createRole(@Body() dto: CreateRoleDto, @Req() req: Request) {
    return this.usersService.createRole(dto, Number(req?.user?.consumer_id));
  }

  @Patch('roles/:id')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  deleteRole(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.usersService.deleteRole(id, Number(req?.user?.consumer_id));
  }
}
