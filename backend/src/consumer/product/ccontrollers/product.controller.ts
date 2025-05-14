import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { CreateProductDto } from '../dtos/create-product-branch.dto';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { CreateUnitDto } from '../dtos/create-unit.dto';
import { ProductService } from '../services/product.service';
import { CreateBranchDto } from '../dtos/create-product.1dto';
import { CreateBrandDto } from '../dtos/create-brand.dto';
import { CreateTagDto } from '../dtos/create-tag.dto';
import { UpdateEntityDto } from '../dtos/update-entity.dto';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { Request } from 'express';
// @HasPermissions([ConsumerPermission.profile])
@UseGuards(ClientAuthGuard, PermissionsGuard)
@Controller('consumer')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // Existing product creation endpoint
  @Post('products')
  async create(
    @Body() createProductDto: CreateProductDto,
    @Req() req: Request,
  ) {
    return this.productService.createProduct(createProductDto, req.user.id);
  }

  @Get('products')
  async getAllProducts(
    @Req() req: Request,
    @Query('search') search?: string,
    @Query('category_id') category_id?: string,
    @Query('brand_id') brand_id?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productService.getAllProducts(req.user.id, {
      search,
      category_id: category_id ? +category_id : undefined,
      brand_id: brand_id ? +brand_id : undefined,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  // Get a single product
  @Get('products/:id')
  async getProduct(@Param('id') id: string, @Req() req: Request) {
    return this.productService.getProduct(+id, req.user.id);
  }

  // Update a product
  @Patch('products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: Partial<CreateProductDto>,
    @Req() req: Request,
  ) {
    return this.productService.updateProduct(
      +id,
      updateProductDto,
      req.user.id,
    );
  }

  // Delete a product
  @Delete('products/:id')
  async deleteProduct(@Param('id') id: string, @Req() req: Request) {
    return this.productService.deleteProduct(+id, req.user.id);
  }

  // Existing create entity endpoints
  @Post('create-branch')
  async createBranch(
    @Body() createBranchDto: CreateBranchDto,
    @Req() req: Request,
  ) {
    return this.productService.createBranch(createBranchDto.name, req.user.id);
  }

  @Post('create-category')
  async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @Req() req: Request,
  ) {
    return this.productService.createCategory(
      createCategoryDto.name,
      req.user.id,
    );
  }

  @Post('create-brand')
  async createBrand(
    @Body() createBrandDto: CreateBrandDto,
    @Req() req: Request,
  ) {
    return this.productService.createBrand(createBrandDto.name, req.user.id);
  }

  @Post('create-unit')
  async createUnit(@Body() createUnitDto: CreateUnitDto, @Req() req: Request) {
    return this.productService.createUnit(createUnitDto.name, req.user.id);
  }

  @Post('create-tag')
  async createTag(@Body() createTagDto: CreateTagDto, @Req() req: Request) {
    return this.productService.createTag(createTagDto.name, req.user.id);
  }

  // Get entity endpoints
  @Get('get-branches')
  async getBranches(@Req() req: Request) {
    return this.productService.getBranches(req.user.id);
  }

  @Get('get-categories')
  async getCategories(@Req() req: Request) {
    return this.productService.getCategories(req.user.id);
  }

  @Get('get-brands')
  async getBrands(@Req() req: Request) {
    return this.productService.getBrands(req.user.id);
  }

  @Get('get-units')
  async getUnits(@Req() req: Request) {
    return this.productService.getUnits(req.user.id);
  }

  @Get('get-tags')
  async getTags(@Req() req: Request) {
    return this.productService.getTags(req.user.id);
  }

  // Update entity endpoints
  @Patch('brands/:id')
  async updateBrand(
    @Param('id') id: string,
    @Body() updateDto: UpdateEntityDto,
  ) {
    return this.productService.updateBrand(+id, updateDto.name);
  }

  @Patch('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() updateDto: UpdateEntityDto,
  ) {
    return this.productService.updateCategory(+id, updateDto.name);
  }

  @Patch('units/:id')
  async updateUnit(
    @Param('id') id: string,
    @Body() updateDto: UpdateEntityDto,
  ) {
    return this.productService.updateUnit(+id, updateDto.name);
  }

  @Patch('branches/:id')
  async updateBranch(
    @Param('id') id: string,
    @Body() updateDto: UpdateEntityDto,
  ) {
    return this.productService.updateBranch(+id, updateDto.name);
  }

  @Patch('tags/:id')
  async updateTag(@Param('id') id: string, @Body() updateDto: UpdateEntityDto) {
    return this.productService.updateTag(+id, updateDto.name);
  }

  // Delete entity endpoints
  @Delete('brands/:id')
  async deleteBrand(@Param('id') id: string) {
    return this.productService.deleteBrand(+id);
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    return this.productService.deleteCategory(+id);
  }

  @Delete('units/:id')
  async deleteUnit(@Param('id') id: string) {
    return this.productService.deleteUnit(+id);
  }

  @Delete('branches/:id')
  async deleteBranch(@Param('id') id: string) {
    return this.productService.deleteBranch(+id);
  }

  @Delete('tags/:id')
  async deleteTag(@Param('id') id: string) {
    return this.productService.deleteTag(+id);
  }
}
