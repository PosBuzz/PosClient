import {
  Body,
  Controller,
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
import { AdminPermission } from 'src/auth/enums/adminPermissions.enum';
import { AdminAuthGuard } from 'src/auth/guards/admin.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import {
  AdminSupportQueryDto,
  AdminSupportReplyDto,
  UpdateSupportTicketDto,
} from '../dto/support.dto';
import { AdminSupportService } from '../services/support.service';

@HasPermissions([AdminPermission.support])
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('admin/support/tickets')
export class AdminSupportController {
  constructor(private readonly service: AdminSupportService) {}

  // Declared before ':id' so 'stats' is not matched as an id.
  @Get('stats')
  stats() {
    return this.service.stats();
  }

  @Get()
  findAll(@Query() query: AdminSupportQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post(':id/messages')
  reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminSupportReplyDto,
    @Req() req: Request,
  ) {
    return this.service.reply(id, Number(req.user?.id), dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return this.service.update(id, dto);
  }
}
