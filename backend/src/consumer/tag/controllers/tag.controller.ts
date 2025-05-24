import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TagService } from '../services/tag.service';
import { CreateTagDto } from '../dto/create-tag.dto';
import { UpdateTagDto } from '../dto/update-tag.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { Request } from 'express';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@Controller('consumer/tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @HasPermissions([ConsumerPermission.add_product, ConsumerPermission.edit_product])
  @Post()
  async create(@Body() createTagDto: CreateTagDto, @Req() req: Request) {
    return this.tagService.create(createTagDto, req.user.id);
  }

  @HasPermissions([ConsumerPermission.view_product, ConsumerPermission.add_product, ConsumerPermission.edit_product])
  @Get()
  async findAll(@Req() req: Request) {
    return this.tagService.findAll(req.user.id);
  }

  @HasPermissions([ConsumerPermission.view_product])
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.tagService.findOne(+id, req.user.id);
  }

  @HasPermissions([ConsumerPermission.edit_product])
  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateTagDto: UpdateTagDto,
    @Req() req: Request
  ) {
    return this.tagService.update(+id, updateTagDto, req.user.id);
  }

  @HasPermissions([ConsumerPermission.delete_product])
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.tagService.remove(+id, req.user.id);
  }
}