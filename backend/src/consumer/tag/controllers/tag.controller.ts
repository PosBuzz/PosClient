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
@HasPermissions([
  ConsumerPermission.view_product,
  ConsumerPermission.add_product,
  ConsumerPermission.edit_product,
  ConsumerPermission.delete_product,
])
@Controller('consumer/tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Post()
  async create(@Body() createTagDto: CreateTagDto, @Req() req: Request) {
    return this.tagService.create(createTagDto, Number(req.user.consumer_id));
  }

  @Get()
  async findAll(@Req() req: Request) {
    return this.tagService.findAll(Number(req.user.consumer_id));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.tagService.findOne(+id, Number(req.user.consumer_id));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateTagDto: UpdateTagDto,
    @Req() req: Request,
  ) {
    return this.tagService.update(+id, updateTagDto, Number(req.user.consumer_id));
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.tagService.remove(+id, Number(req.user.consumer_id));
  }
}
