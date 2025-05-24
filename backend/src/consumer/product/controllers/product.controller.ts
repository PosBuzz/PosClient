import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import { ProductService } from '../services/product.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';
import { Request } from 'express';

@Controller('consumer/products')
@UseGuards(ClientAuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  create(@Req() req: Request, @Body() createProductDto: CreateProductDto) {
    return this.productService.create(
      Number(req?.user.consumer_id),
      createProductDto,
    );
  }

  @Get()
  findAll(
    @Req() req: Request,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('categoryIds') categoryIds?: string, // Accept as comma-separated string
    @Query('brandIds') brandIds?: string,       // Accept as comma-separated string
    @Query('tagIds') tagIds?: string,           // Accept as comma-separated string
  ) {
    // Parse comma-separated strings to number arrays
    const parseCategoryIds = categoryIds ? categoryIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : undefined;
    const parseBrandIds = brandIds ? brandIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : undefined;
    const parseTagIds = tagIds ? tagIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : undefined;

    return this.productService.findAll(Number(req?.user.consumer_id), {
      page,
      limit,
      search,
      categoryIds: parseCategoryIds,
      brandIds: parseBrandIds,
      tagIds: parseTagIds,
    });
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.productService.findOne(id, Number(req?.user.consumer_id));
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productService.update(
      id,
      updateProductDto,
      Number(req?.user.consumer_id),
    );
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    return this.productService.remove(id, Number(req?.user.consumer_id));
  }
}
