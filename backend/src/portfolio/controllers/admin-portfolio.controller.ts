import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AdminPermission } from 'src/auth/enums/adminPermissions.enum';
import { AdminAuthGuard } from 'src/auth/guards/admin.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import {
  DemoProductDto,
  FaqDto,
  FeatureDto,
  PricingPlanDto,
  SolutionDto,
  TestimonialDto,
  UpdatePortfolioSettingsDto,
} from '../dto/portfolio-content.dto';
import {
  PortfolioLeadQueryDto,
  UpdatePortfolioLeadDto,
} from '../dto/portfolio-lead.dto';
import { PortfolioRevalidateInterceptor } from '../interceptors/portfolio-revalidate.interceptor';
import { PortfolioContentService } from '../services/portfolio-content.service';
import { PortfolioLeadService } from '../services/portfolio-lead.service';
import { PortfolioRevalidationService } from '../services/portfolio-revalidation.service';

@HasPermissions([AdminPermission.portfolio])
@UseGuards(AdminAuthGuard, PermissionsGuard)
@UseInterceptors(PortfolioRevalidateInterceptor)
@Controller('admin/portfolio')
export class AdminPortfolioController {
  constructor(
    private readonly content: PortfolioContentService,
    private readonly leads: PortfolioLeadService,
    private readonly revalidation: PortfolioRevalidationService,
  ) {}

  // ---------- Publishing ----------

  /** Manual "Publish now", for cache-busting without editing anything. */
  @Post('revalidate')
  revalidate() {
    return this.revalidation.trigger();
  }

  @Get('publish-status')
  publishStatus() {
    return { configured: this.revalidation.isConfigured };
  }

  // ---------- Settings ----------

  @Get('settings')
  getSettings() {
    return this.content.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() dto: UpdatePortfolioSettingsDto) {
    return this.content.updateSettings(dto);
  }

  // ---------- Solutions ----------

  @Get('solutions')
  listSolutions() {
    return this.content.listSolutions();
  }

  @Post('solutions')
  createSolution(@Body() dto: SolutionDto) {
    return this.content.createSolution(dto);
  }

  @Patch('solutions/:id')
  updateSolution(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SolutionDto,
  ) {
    return this.content.updateSolution(id, dto);
  }

  @Delete('solutions/:id')
  removeSolution(@Param('id', ParseIntPipe) id: number) {
    return this.content.removeSolution(id);
  }

  // ---------- Features ----------

  @Get('features')
  listFeatures() {
    return this.content.listFeatures();
  }

  @Post('features')
  createFeature(@Body() dto: FeatureDto) {
    return this.content.createFeature(dto);
  }

  @Patch('features/:id')
  updateFeature(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FeatureDto,
  ) {
    return this.content.updateFeature(id, dto);
  }

  @Delete('features/:id')
  removeFeature(@Param('id', ParseIntPipe) id: number) {
    return this.content.removeFeature(id);
  }

  // ---------- Pricing plans ----------

  @Get('pricing-plans')
  listPricingPlans() {
    return this.content.listPricingPlans();
  }

  @Post('pricing-plans')
  createPricingPlan(@Body() dto: PricingPlanDto) {
    return this.content.createPricingPlan(dto);
  }

  @Patch('pricing-plans/:id')
  updatePricingPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PricingPlanDto,
  ) {
    return this.content.updatePricingPlan(id, dto);
  }

  @Delete('pricing-plans/:id')
  removePricingPlan(@Param('id', ParseIntPipe) id: number) {
    return this.content.removePricingPlan(id);
  }

  // ---------- FAQs ----------

  @Get('faqs')
  listFaqs() {
    return this.content.listFaqs();
  }

  @Post('faqs')
  createFaq(@Body() dto: FaqDto) {
    return this.content.createFaq(dto);
  }

  @Patch('faqs/:id')
  updateFaq(@Param('id', ParseIntPipe) id: number, @Body() dto: FaqDto) {
    return this.content.updateFaq(id, dto);
  }

  @Delete('faqs/:id')
  removeFaq(@Param('id', ParseIntPipe) id: number) {
    return this.content.removeFaq(id);
  }

  // ---------- Testimonials ----------

  @Get('testimonials')
  listTestimonials() {
    return this.content.listTestimonials();
  }

  @Post('testimonials')
  createTestimonial(@Body() dto: TestimonialDto) {
    return this.content.createTestimonial(dto);
  }

  @Patch('testimonials/:id')
  updateTestimonial(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TestimonialDto,
  ) {
    return this.content.updateTestimonial(id, dto);
  }

  @Delete('testimonials/:id')
  removeTestimonial(@Param('id', ParseIntPipe) id: number) {
    return this.content.removeTestimonial(id);
  }

  // ---------- Demo products ----------

  @Get('demo-products')
  listDemoProducts() {
    return this.content.listDemoProducts();
  }

  @Post('demo-products')
  createDemoProduct(@Body() dto: DemoProductDto) {
    return this.content.createDemoProduct(dto);
  }

  @Patch('demo-products/:id')
  updateDemoProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DemoProductDto,
  ) {
    return this.content.updateDemoProduct(id, dto);
  }

  @Delete('demo-products/:id')
  removeDemoProduct(@Param('id', ParseIntPipe) id: number) {
    return this.content.removeDemoProduct(id);
  }

  // ---------- Leads ----------

  // Declared before ':id' style routes so 'stats' is not read as an id.
  @Get('leads/stats')
  leadStats() {
    return this.leads.stats();
  }

  @Get('leads')
  listLeads(@Query() query: PortfolioLeadQueryDto) {
    return this.leads.findAll(query);
  }

  @Patch('leads/:id')
  updateLead(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePortfolioLeadDto,
  ) {
    return this.leads.update(id, dto);
  }

  @Delete('leads/:id')
  removeLead(@Param('id', ParseIntPipe) id: number) {
    return this.leads.remove(id);
  }
}
