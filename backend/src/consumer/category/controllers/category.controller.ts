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

import { CreateCategoryDto } from '../dto/create-category.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { Request } from 'express';
import { CategoryService } from '../services/category.service';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@Controller('consumer/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @HasPermissions([ConsumerPermission.add_product, ConsumerPermission.edit_product])
  @Post()
  async create(@Body() createCategoryDto: CreateCategoryDto, @Req() req: Request) {
    return this.categoryService.create(createCategoryDto, req.user.id);
  }

  @HasPermissions([ConsumerPermission.view_product, ConsumerPermission.add_product, ConsumerPermission.edit_product])
  @Get()
  async findAll(@Req() req: Request) {
    return this.categoryService.findAll(req.user.id);
  }

  @HasPermissions([ConsumerPermission.view_product])
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.categoryService.findOne(+id, req.user.id);
  }

  @HasPermissions([ConsumerPermission.edit_product])
  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Req() req: Request
  ) {
    return this.categoryService.update(+id, updateCategoryDto, req.user.id);
  }

  @HasPermissions([ConsumerPermission.delete_product])
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.categoryService.remove(+id, req.user.id);
  }
}