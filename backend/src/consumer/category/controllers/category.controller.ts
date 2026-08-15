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
@HasPermissions([
  ConsumerPermission.view_product,
  ConsumerPermission.add_product,
  ConsumerPermission.edit_product,
  ConsumerPermission.delete_product,
])
@Controller('consumer/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @Req() req: Request,
  ) {
    return this.categoryService.create(
      createCategoryDto,
      Number(req.user.consumer_id),
    );
  }

  @Get()
  async findAll(@Req() req: Request) {
    return this.categoryService.findAll(Number(req.user.consumer_id));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.categoryService.findOne(+id, Number(req.user.consumer_id));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Req() req: Request,
  ) {
    return this.categoryService.update(
      +id,
      updateCategoryDto,
      Number(req.user.consumer_id),
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.categoryService.remove(+id, Number(req.user.consumer_id));
  }
}
