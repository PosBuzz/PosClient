import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CreatePortfolioLeadDto } from '../dto/portfolio-lead.dto';
import { PortfolioContentService } from '../services/portfolio-content.service';
import { PortfolioLeadService } from '../services/portfolio-lead.service';

/**
 * Unauthenticated endpoints consumed by the Next.js marketing site.
 * `/api/v1/public/*` is exempt from CSRF (see main.ts).
 */
@Controller('public/portfolio')
export class PublicPortfolioController {
  constructor(
    private readonly content: PortfolioContentService,
    private readonly leads: PortfolioLeadService,
  ) {}

  @Get('content')
  allContent() {
    return this.content.publicContent();
  }

  @Get('settings')
  settings() {
    return this.content.getSettings();
  }

  @Get('solutions')
  solutions() {
    return this.content.publicSolutions();
  }

  @Get('features')
  features() {
    return this.content.publicFeatures();
  }

  @Get('pricing-plans')
  pricingPlans() {
    return this.content.publicPricingPlans();
  }

  @Get('faqs')
  faqs() {
    return this.content.publicFaqs();
  }

  @Get('testimonials')
  testimonials() {
    return this.content.publicTestimonials();
  }

  @Get('demo-products')
  demoProducts() {
    return this.content.publicDemoProducts();
  }

  @Post('leads')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3600 * 1000 } })
  createLead(@Body() dto: CreatePortfolioLeadDto) {
    return this.leads.create(dto);
  }
}
