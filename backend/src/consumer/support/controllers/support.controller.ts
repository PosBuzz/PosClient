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
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import {
  AddSupportMessageDto,
  CreateSupportTicketDto,
  SupportTicketQueryDto,
} from '../dto/support-ticket.dto';
import { SupportService } from '../services/support.service';

@Controller('consumer/support/tickets')
@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.support])
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Get()
  findAll(@Query() query: SupportTicketQueryDto, @Req() req: Request) {
    return this.service.findAll(req.user.consumer_id!, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.findOne(id, req.user.consumer_id!);
  }

  @Post()
  create(@Body() dto: CreateSupportTicketDto, @Req() req: Request) {
    return this.service.create(req.user.consumer_id!, req.user.id, dto);
  }

  @Post(':id/messages')
  addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddSupportMessageDto,
    @Req() req: Request,
  ) {
    return this.service.addMessage(id, req.user.consumer_id!, req.user.id, dto);
  }

  @Patch(':id/close')
  close(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.close(id, req.user.consumer_id!);
  }

  @Patch(':id/reopen')
  reopen(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.service.reopen(id, req.user.consumer_id!);
  }
}
