import { Controller, Post, Body } from '@nestjs/common';
import { CreateProductDto } from '../dtos/create-product-branch.dto';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { CreateUnitDto } from '../dtos/create-unit.dto';
import { ProductService } from '../services/product.service';
import { CreateBranchDto } from '../dtos/create-product.dto';
import { CreateBrandDto } from '../dtos/create-brand.dto';

@Controller('consumer')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post('products')
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productService.createProduct(createProductDto);
  }

  @Post('create-branch')
  async createBranch(@Body() createBranchDto: CreateBranchDto) {
    return this.productService.createBranch(createBranchDto.name);
  }

  @Post('create-category')
  async createCategory(@Body() createCategoryDto: CreateCategoryDto) {
    return this.productService.createCategory(createCategoryDto.name);
  }

  @Post('create-brand')
  async createBrand(@Body() createBrandDto: CreateBrandDto) {
    return this.productService.createBrand(createBrandDto.name);
  }

  @Post('create-unit')
  async createUnit(@Body() createUnitDto: CreateUnitDto) {
    return this.productService.createUnit(createUnitDto.name);
  }
}
