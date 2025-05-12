import { Controller, Post, Body, Get, Param, Patch, Delete } from '@nestjs/common';
import { CreateProductDto } from '../dtos/create-product-branch.dto';
import { CreateCategoryDto } from '../dtos/create-category.dto';
import { CreateUnitDto } from '../dtos/create-unit.dto';
import { ProductService } from '../services/product.service';
import { CreateBranchDto } from '../dtos/create-product.dto';
import { CreateBrandDto } from '../dtos/create-brand.dto';
import { CreateTagDto } from '../dtos/create-tag.dto';
import { UpdateEntityDto } from '../dtos/update-entity.dto';

@Controller('consumer')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  // Existing product creation endpoint
  @Post('products')
  async create(@Body() createProductDto: CreateProductDto) {
    return this.productService.createProduct(createProductDto);
  }

  // Get a single product
  @Get('products/:id')
  async getProduct(@Param('id') id: string) {
    return this.productService.getProduct(+id);
  }

  // Update a product
  @Patch('products/:id')
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: Partial<CreateProductDto>
  ) {
    return this.productService.updateProduct(+id, updateProductDto);
  }

  // Delete a product
  @Delete('products/:id')
  async deleteProduct(@Param('id') id: string) {
    return this.productService.deleteProduct(+id);
  }

  // Product variants endpoints
  @Get('products/:productId/variants')
  async getVariants(@Param('productId') productId: string) {
    return this.productService.getVariants(+productId);
  }

  @Post('products/:productId/variants')
  async createVariant(
    @Param('productId') productId: string,
    @Body() variantData: any
  ) {
    return this.productService.createVariant(+productId, variantData);
  }

  @Patch('variants/:id')
  async updateVariant(
    @Param('id') id: string,
    @Body() variantData: any
  ) {
    return this.productService.updateVariant(+id, variantData);
  }

  @Delete('variants/:id')
  async deleteVariant(@Param('id') id: string) {
    return this.productService.deleteVariant(+id);
  }

  // Branch price endpoints
  @Get('products/:productId/branch-prices')
  async getBranchPrices(@Param('productId') productId: string) {
    return this.productService.getBranchPrices(+productId);
  }

  @Post('products/:productId/branch-prices')
  async createBranchPrice(
    @Param('productId') productId: string,
    @Body() branchPriceData: any
  ) {
    return this.productService.createBranchPrice(+productId, branchPriceData);
  }

  @Patch('branch-prices/:id')
  async updateBranchPrice(
    @Param('id') id: string,
    @Body() branchPriceData: any
  ) {
    return this.productService.updateBranchPrice(+id, branchPriceData);
  }

  @Delete('branch-prices/:id')
  async deleteBranchPrice(@Param('id') id: string) {
    return this.productService.deleteBranchPrice(+id);
  }

  // Serials endpoints
  @Get('products/:productId/serials')
  async getSerials(@Param('productId') productId: string) {
    return this.productService.getSerials(+productId);
  }

  @Post('products/:productId/serials')
  async createSerial(
    @Param('productId') productId: string,
    @Body() serialData: { serial: string }
  ) {
    return this.productService.createSerial(+productId, serialData.serial);
  }

  @Patch('serials/:id')
  async updateSerial(
    @Param('id') id: string,
    @Body() serialData: { serial: string }
  ) {
    return this.productService.updateSerial(+id, serialData.serial);
  }

  @Delete('serials/:id')
  async deleteSerial(@Param('id') id: string) {
    return this.productService.deleteSerial(+id);
  }

  // Promotional price endpoints
  @Get('products/:productId/promotional-price')
  async getPromotionalPrice(@Param('productId') productId: string) {
    return this.productService.getPromotionalPrice(+productId);
  }

  @Post('products/:productId/promotional-price')
  async createPromotionalPrice(
    @Param('productId') productId: string,
    @Body() promoData: any
  ) {
    return this.productService.createPromotionalPrice(+productId, promoData);
  }

  @Patch('products/:productId/promotional-price')
  async updatePromotionalPrice(
    @Param('productId') productId: string,
    @Body() promoData: any
  ) {
    return this.productService.updatePromotionalPrice(+productId, promoData);
  }

  @Delete('products/:productId/promotional-price')
  async deletePromotionalPrice(@Param('productId') productId: string) {
    return this.productService.deletePromotionalPrice(+productId);
  }

  // Tags endpoints
  @Get('products/:productId/tags')
  async getProductTags(@Param('productId') productId: string) {
    return this.productService.getProductTags(+productId);
  }

  @Post('products/:productId/tags')
  async addProductTag(
    @Param('productId') productId: string,
    @Body() tagData: { tag: string }
  ) {
    return this.productService.addProductTag(+productId, tagData.tag);
  }

  @Delete('products/:productId/tags/:tagId')
  async removeProductTag(
    @Param('productId') productId: string,
    @Param('tagId') tagId: string
  ) {
    return this.productService.removeProductTag(+productId, +tagId);
  }

  // Existing create entity endpoints
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

  @Post('create-tag')
  async createTag(@Body() createTagDto: CreateTagDto) {
    return this.productService.createTag(createTagDto.name);
  }

  // Get entity endpoints
  @Get('get-branches')
  async getBranches() {
    return this.productService.getBranches();
  }

  @Get('get-categories')
  async getCategories() {
    return this.productService.getCategories();
  }

  @Get('get-brands')
  async getBrands() {
    return this.productService.getBrands();
  }

  @Get('get-units')
  async getUnits() {
    return this.productService.getUnits();
  }

  @Get('get-tags')
  async getTags() {
    return this.productService.getTags();
  }

  // Update entity endpoints
  @Patch('brands/:id')
  async updateBrand(
    @Param('id') id: string,
    @Body() updateDto: UpdateEntityDto
  ) {
    return this.productService.updateBrand(+id, updateDto.name);
  }

  @Patch('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() updateDto: UpdateEntityDto
  ) {
    return this.productService.updateCategory(+id, updateDto.name);
  }

  @Patch('units/:id')
  async updateUnit(
    @Param('id') id: string,
    @Body() updateDto: UpdateEntityDto
  ) {
    return this.productService.updateUnit(+id, updateDto.name);
  }

  @Patch('branches/:id')
  async updateBranch(
    @Param('id') id: string,
    @Body() updateDto: UpdateEntityDto
  ) {
    return this.productService.updateBranch(+id, updateDto.name);
  }

  @Patch('tags/:id')
  async updateTag(
    @Param('id') id: string,
    @Body() updateDto: UpdateEntityDto
  ) {
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
