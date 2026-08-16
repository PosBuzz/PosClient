import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  DemoProductDto,
  FaqDto,
  FeatureDto,
  PricingPlanDto,
  SolutionDto,
  TestimonialDto,
  UpdatePortfolioSettingsDto,
} from '../dto/portfolio-content.dto';

const SETTINGS_ID = 1;

const publishedOrder = {
  where: { is_published: true },
  orderBy: [{ sort_order: 'asc' as const }, { id: 'asc' as const }],
};

const adminOrder = {
  orderBy: [{ sort_order: 'asc' as const }, { id: 'asc' as const }],
};

@Injectable()
export class PortfolioContentService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Public reads ----------

  /**
   * Everything the marketing site renders, in one round trip. The Next.js app
   * fetches this once per ISR revalidation instead of six separate calls.
   */
  async publicContent() {
    const [
      settings,
      solutions,
      features,
      pricing_plans,
      faqs,
      testimonials,
      demo_products,
    ] = await Promise.all([
      this.getSettings(),
      this.prisma.portfolioSolution.findMany(publishedOrder),
      this.prisma.portfolioFeature.findMany(publishedOrder),
      this.prisma.portfolioPricingPlan.findMany(publishedOrder),
      this.prisma.portfolioFaq.findMany(publishedOrder),
      this.prisma.portfolioTestimonial.findMany(publishedOrder),
      this.prisma.portfolioDemoProduct.findMany(publishedOrder),
    ]);

    return {
      settings,
      solutions,
      features,
      pricing_plans,
      faqs,
      testimonials,
      demo_products,
    };
  }

  publicSolutions() {
    return this.prisma.portfolioSolution.findMany(publishedOrder);
  }
  publicFeatures() {
    return this.prisma.portfolioFeature.findMany(publishedOrder);
  }
  publicPricingPlans() {
    return this.prisma.portfolioPricingPlan.findMany(publishedOrder);
  }
  publicFaqs() {
    return this.prisma.portfolioFaq.findMany(publishedOrder);
  }
  publicTestimonials() {
    return this.prisma.portfolioTestimonial.findMany(publishedOrder);
  }
  publicDemoProducts() {
    return this.prisma.portfolioDemoProduct.findMany(publishedOrder);
  }

  // ---------- Settings ----------

  getSettings() {
    return this.prisma.portfolioSetting.findUnique({
      where: { id: SETTINGS_ID },
    });
  }

  updateSettings(dto: UpdatePortfolioSettingsDto) {
    return this.prisma.portfolioSetting.upsert({
      where: { id: SETTINGS_ID },
      update: { ...dto },
      create: { id: SETTINGS_ID, ...dto },
    });
  }

  // ---------- Solutions ----------

  listSolutions() {
    return this.prisma.portfolioSolution.findMany(adminOrder);
  }
  createSolution(dto: SolutionDto) {
    return this.prisma.portfolioSolution.create({ data: dto });
  }
  async updateSolution(id: number, dto: SolutionDto) {
    await this.assert(
      this.prisma.portfolioSolution.findUnique({ where: { id } }),
    );
    return this.prisma.portfolioSolution.update({ where: { id }, data: dto });
  }
  async removeSolution(id: number) {
    await this.assert(
      this.prisma.portfolioSolution.findUnique({ where: { id } }),
    );
    await this.prisma.portfolioSolution.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Features ----------

  listFeatures() {
    return this.prisma.portfolioFeature.findMany(adminOrder);
  }
  createFeature(dto: FeatureDto) {
    return this.prisma.portfolioFeature.create({ data: dto });
  }
  async updateFeature(id: number, dto: FeatureDto) {
    await this.assert(
      this.prisma.portfolioFeature.findUnique({ where: { id } }),
    );
    return this.prisma.portfolioFeature.update({ where: { id }, data: dto });
  }
  async removeFeature(id: number) {
    await this.assert(
      this.prisma.portfolioFeature.findUnique({ where: { id } }),
    );
    await this.prisma.portfolioFeature.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Pricing plans ----------

  listPricingPlans() {
    return this.prisma.portfolioPricingPlan.findMany(adminOrder);
  }
  createPricingPlan(dto: PricingPlanDto) {
    return this.prisma.portfolioPricingPlan.create({ data: dto });
  }
  async updatePricingPlan(id: number, dto: PricingPlanDto) {
    await this.assert(
      this.prisma.portfolioPricingPlan.findUnique({ where: { id } }),
    );
    return this.prisma.portfolioPricingPlan.update({
      where: { id },
      data: dto,
    });
  }
  async removePricingPlan(id: number) {
    await this.assert(
      this.prisma.portfolioPricingPlan.findUnique({ where: { id } }),
    );
    await this.prisma.portfolioPricingPlan.delete({ where: { id } });
    return { success: true };
  }

  // ---------- FAQs ----------

  listFaqs() {
    return this.prisma.portfolioFaq.findMany(adminOrder);
  }
  createFaq(dto: FaqDto) {
    return this.prisma.portfolioFaq.create({ data: dto });
  }
  async updateFaq(id: number, dto: FaqDto) {
    await this.assert(this.prisma.portfolioFaq.findUnique({ where: { id } }));
    return this.prisma.portfolioFaq.update({ where: { id }, data: dto });
  }
  async removeFaq(id: number) {
    await this.assert(this.prisma.portfolioFaq.findUnique({ where: { id } }));
    await this.prisma.portfolioFaq.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Testimonials ----------

  listTestimonials() {
    return this.prisma.portfolioTestimonial.findMany(adminOrder);
  }
  createTestimonial(dto: TestimonialDto) {
    return this.prisma.portfolioTestimonial.create({ data: dto });
  }
  async updateTestimonial(id: number, dto: TestimonialDto) {
    await this.assert(
      this.prisma.portfolioTestimonial.findUnique({ where: { id } }),
    );
    return this.prisma.portfolioTestimonial.update({
      where: { id },
      data: dto,
    });
  }
  async removeTestimonial(id: number) {
    await this.assert(
      this.prisma.portfolioTestimonial.findUnique({ where: { id } }),
    );
    await this.prisma.portfolioTestimonial.delete({ where: { id } });
    return { success: true };
  }

  // ---------- Demo products ----------

  listDemoProducts() {
    return this.prisma.portfolioDemoProduct.findMany(adminOrder);
  }
  createDemoProduct(dto: DemoProductDto) {
    return this.prisma.portfolioDemoProduct.create({ data: dto });
  }
  async updateDemoProduct(id: number, dto: DemoProductDto) {
    await this.assert(
      this.prisma.portfolioDemoProduct.findUnique({ where: { id } }),
    );
    return this.prisma.portfolioDemoProduct.update({
      where: { id },
      data: dto,
    });
  }
  async removeDemoProduct(id: number) {
    await this.assert(
      this.prisma.portfolioDemoProduct.findUnique({ where: { id } }),
    );
    await this.prisma.portfolioDemoProduct.delete({ where: { id } });
    return { success: true };
  }

  private async assert<T>(query: Promise<T | null>) {
    const record = await query;
    if (!record) throw new NotFoundException('Portfolio record not found');
    return record;
  }
}
