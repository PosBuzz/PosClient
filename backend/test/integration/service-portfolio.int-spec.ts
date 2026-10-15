import { NotFoundException } from '@nestjs/common';
import { PortfolioContentService } from '../../src/portfolio/services/portfolio-content.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { getPrisma, resetDb, disconnect } from '../helpers/db';

describe('portfolio content persistence', () => {
  const db = getPrisma();
  const service = new PortfolioContentService(db as unknown as PrismaService);
  beforeEach(resetDb);
  afterAll(disconnect);

  it('[BE-CMS-100] {PortfolioContentService.createSolution} {PortfolioContentService.listSolutions} {PortfolioContentService.publicSolutions} {PortfolioContentService.updateSolution} {PortfolioContentService.removeSolution} stores, orders, publishes and removes Solutions', async () => {
    const dto = {
      slug: 'retail',
      title: 'Retail',
      subtitle: 'Fast checkout',
      icon_name: 'shop',
      badge: 'POS',
      description: 'Retail tools',
      features: ['Stock'],
      benefits: ['Accuracy'],
      metric_label: 'Stores',
      metric_value: '10',
      image_key: 'retail',
    };
    const hidden = await service.createSolution({
      ...dto,
      sort_order: -1,
      is_published: false,
    });
    const later = await service.createSolution({
      ...dto,
      slug: dto.slug + '-later',
      sort_order: 2,
      is_published: true,
    });
    const first = await service.createSolution({
      ...dto,
      slug: dto.slug + '-first',
      sort_order: 1,
      is_published: true,
    });
    expect(
      await db.portfolioSolution.findUniqueOrThrow({
        where: { id: hidden.id },
      }),
    ).toMatchObject({ is_published: false, sort_order: -1 });
    expect((await service.listSolutions()).map((row) => row.id)).toEqual([
      hidden.id,
      first.id,
      later.id,
    ]);
    expect((await service.publicSolutions()).map((row) => row.id)).toEqual([
      first.id,
      later.id,
    ]);
    expect(
      await service.updateSolution(hidden.id, {
        ...dto,
        sort_order: 0,
        is_published: true,
      }),
    ).toMatchObject({ id: hidden.id, sort_order: 0, is_published: true });
    expect(
      await db.portfolioSolution.findUniqueOrThrow({
        where: { id: hidden.id },
      }),
    ).toMatchObject({ sort_order: 0, is_published: true });
    expect((await service.publicSolutions()).map((row) => row.id)).toEqual([
      hidden.id,
      first.id,
      later.id,
    ]);
    expect(await service.removeSolution(first.id)).toEqual({ success: true });
    expect(await db.portfolioSolution.count({ where: { id: first.id } })).toBe(
      0,
    );
    for (const request of [
      () => service.updateSolution(first.id, dto),
      () => service.removeSolution(first.id),
    ]) {
      const error = await request().catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('Portfolio record not found');
      expect(await db.portfolioSolution.count()).toBe(2);
    }
  });

  it('[BE-CMS-101] {PortfolioContentService.createFeature} {PortfolioContentService.listFeatures} {PortfolioContentService.publicFeatures} {PortfolioContentService.updateFeature} {PortfolioContentService.removeFeature} stores, orders, publishes and removes Features', async () => {
    const dto = {
      slug: 'stock',
      category: 'inventory',
      title: 'Stock',
      tagline: 'Track stock',
      description: 'Inventory tools',
      highlights: ['Audit'],
      icon: 'box',
    };
    const hidden = await service.createFeature({
      ...dto,
      sort_order: -1,
      is_published: false,
    });
    const later = await service.createFeature({
      ...dto,
      slug: dto.slug + '-later',
      sort_order: 2,
      is_published: true,
    });
    const first = await service.createFeature({
      ...dto,
      slug: dto.slug + '-first',
      sort_order: 1,
      is_published: true,
    });
    expect(
      await db.portfolioFeature.findUniqueOrThrow({ where: { id: hidden.id } }),
    ).toMatchObject({ is_published: false, sort_order: -1 });
    expect((await service.listFeatures()).map((row) => row.id)).toEqual([
      hidden.id,
      first.id,
      later.id,
    ]);
    expect((await service.publicFeatures()).map((row) => row.id)).toEqual([
      first.id,
      later.id,
    ]);
    expect(
      await service.updateFeature(hidden.id, {
        ...dto,
        sort_order: 0,
        is_published: true,
      }),
    ).toMatchObject({ id: hidden.id, sort_order: 0, is_published: true });
    expect(
      await db.portfolioFeature.findUniqueOrThrow({ where: { id: hidden.id } }),
    ).toMatchObject({ sort_order: 0, is_published: true });
    expect((await service.publicFeatures()).map((row) => row.id)).toEqual([
      hidden.id,
      first.id,
      later.id,
    ]);
    expect(await service.removeFeature(first.id)).toEqual({ success: true });
    expect(await db.portfolioFeature.count({ where: { id: first.id } })).toBe(
      0,
    );
    for (const request of [
      () => service.updateFeature(first.id, dto),
      () => service.removeFeature(first.id),
    ]) {
      const error = await request().catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('Portfolio record not found');
      expect(await db.portfolioFeature.count()).toBe(2);
    }
  });

  it('[BE-CMS-102] {PortfolioContentService.createPricingPlan} {PortfolioContentService.listPricingPlans} {PortfolioContentService.publicPricingPlans} {PortfolioContentService.updatePricingPlan} {PortfolioContentService.removePricingPlan} stores, orders, publishes and removes PricingPlans', async () => {
    const dto = {
      slug: 'starter',
      name: 'Starter',
      description: 'Starter plan',
      price_monthly: 123.45,
      price_annual_monthly: 100.25,
      features: ['Sales'],
      cta: 'Start',
    };
    const hidden = await service.createPricingPlan({
      ...dto,
      sort_order: -1,
      is_published: false,
    });
    const later = await service.createPricingPlan({
      ...dto,
      slug: dto.slug + '-later',
      sort_order: 2,
      is_published: true,
    });
    const first = await service.createPricingPlan({
      ...dto,
      slug: dto.slug + '-first',
      sort_order: 1,
      is_published: true,
    });
    expect(
      await db.portfolioPricingPlan.findUniqueOrThrow({
        where: { id: hidden.id },
      }),
    ).toMatchObject({ is_published: false, sort_order: -1 });
    expect((await service.listPricingPlans()).map((row) => row.id)).toEqual([
      hidden.id,
      first.id,
      later.id,
    ]);
    expect((await service.publicPricingPlans()).map((row) => row.id)).toEqual([
      first.id,
      later.id,
    ]);
    expect(
      await service.updatePricingPlan(hidden.id, {
        ...dto,
        sort_order: 0,
        is_published: true,
      }),
    ).toMatchObject({ id: hidden.id, sort_order: 0, is_published: true });
    expect(
      await db.portfolioPricingPlan.findUniqueOrThrow({
        where: { id: hidden.id },
      }),
    ).toMatchObject({ sort_order: 0, is_published: true });
    expect((await service.publicPricingPlans()).map((row) => row.id)).toEqual([
      hidden.id,
      first.id,
      later.id,
    ]);
    expect(await service.removePricingPlan(first.id)).toEqual({
      success: true,
    });
    expect(
      await db.portfolioPricingPlan.count({ where: { id: first.id } }),
    ).toBe(0);
    for (const request of [
      () => service.updatePricingPlan(first.id, dto),
      () => service.removePricingPlan(first.id),
    ]) {
      const error = await request().catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('Portfolio record not found');
      expect(await db.portfolioPricingPlan.count()).toBe(2);
    }
  });

  it('[BE-CMS-103] {PortfolioContentService.createFaq} {PortfolioContentService.listFaqs} {PortfolioContentService.publicFaqs} {PortfolioContentService.updateFaq} {PortfolioContentService.removeFaq} stores, orders, publishes and removes Faqs', async () => {
    const dto = {
      question: 'How?',
      answer: 'Use checkout',
      aeo_summary: 'Checkout',
      category: 'sales',
    };
    const hidden = await service.createFaq({
      ...dto,
      sort_order: -1,
      is_published: false,
    });
    const later = await service.createFaq({
      ...dto,
      sort_order: 2,
      is_published: true,
    });
    const first = await service.createFaq({
      ...dto,
      sort_order: 1,
      is_published: true,
    });
    expect(
      await db.portfolioFaq.findUniqueOrThrow({ where: { id: hidden.id } }),
    ).toMatchObject({ is_published: false, sort_order: -1 });
    expect((await service.listFaqs()).map((row) => row.id)).toEqual([
      hidden.id,
      first.id,
      later.id,
    ]);
    expect((await service.publicFaqs()).map((row) => row.id)).toEqual([
      first.id,
      later.id,
    ]);
    expect(
      await service.updateFaq(hidden.id, {
        ...dto,
        sort_order: 0,
        is_published: true,
      }),
    ).toMatchObject({ id: hidden.id, sort_order: 0, is_published: true });
    expect(
      await db.portfolioFaq.findUniqueOrThrow({ where: { id: hidden.id } }),
    ).toMatchObject({ sort_order: 0, is_published: true });
    expect((await service.publicFaqs()).map((row) => row.id)).toEqual([
      hidden.id,
      first.id,
      later.id,
    ]);
    expect(await service.removeFaq(first.id)).toEqual({ success: true });
    expect(await db.portfolioFaq.count({ where: { id: first.id } })).toBe(0);
    for (const request of [
      () => service.updateFaq(first.id, dto),
      () => service.removeFaq(first.id),
    ]) {
      const error = await request().catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('Portfolio record not found');
      expect(await db.portfolioFaq.count()).toBe(2);
    }
  });

  it('[BE-CMS-104] {PortfolioContentService.createTestimonial} {PortfolioContentService.listTestimonials} {PortfolioContentService.publicTestimonials} {PortfolioContentService.updateTestimonial} {PortfolioContentService.removeTestimonial} stores, orders, publishes and removes Testimonials', async () => {
    const dto = {
      quote: 'Useful',
      author: 'Ali',
      role: 'Owner',
      company: 'Shop',
      rating: 5,
    };
    const hidden = await service.createTestimonial({
      ...dto,
      sort_order: -1,
      is_published: false,
    });
    const later = await service.createTestimonial({
      ...dto,
      sort_order: 2,
      is_published: true,
    });
    const first = await service.createTestimonial({
      ...dto,
      sort_order: 1,
      is_published: true,
    });
    expect(
      await db.portfolioTestimonial.findUniqueOrThrow({
        where: { id: hidden.id },
      }),
    ).toMatchObject({ is_published: false, sort_order: -1 });
    expect((await service.listTestimonials()).map((row) => row.id)).toEqual([
      hidden.id,
      first.id,
      later.id,
    ]);
    expect((await service.publicTestimonials()).map((row) => row.id)).toEqual([
      first.id,
      later.id,
    ]);
    expect(
      await service.updateTestimonial(hidden.id, {
        ...dto,
        sort_order: 0,
        is_published: true,
      }),
    ).toMatchObject({ id: hidden.id, sort_order: 0, is_published: true });
    expect(
      await db.portfolioTestimonial.findUniqueOrThrow({
        where: { id: hidden.id },
      }),
    ).toMatchObject({ sort_order: 0, is_published: true });
    expect((await service.publicTestimonials()).map((row) => row.id)).toEqual([
      hidden.id,
      first.id,
      later.id,
    ]);
    expect(await service.removeTestimonial(first.id)).toEqual({
      success: true,
    });
    expect(
      await db.portfolioTestimonial.count({ where: { id: first.id } }),
    ).toBe(0);
    for (const request of [
      () => service.updateTestimonial(first.id, dto),
      () => service.removeTestimonial(first.id),
    ]) {
      const error = await request().catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('Portfolio record not found');
      expect(await db.portfolioTestimonial.count()).toBe(2);
    }
  });

  it('[BE-CMS-105] {PortfolioContentService.createDemoProduct} {PortfolioContentService.listDemoProducts} {PortfolioContentService.publicDemoProducts} {PortfolioContentService.updateDemoProduct} {PortfolioContentService.removeDemoProduct} stores, orders, publishes and removes DemoProducts', async () => {
    const dto = {
      name: 'Rice',
      sku: 'RICE',
      price: 123.45,
      wholesale_price: 100.25,
      category: 'grocery',
      image: 'rice',
      tax: 0.15,
    };
    const hidden = await service.createDemoProduct({
      ...dto,
      sort_order: -1,
      is_published: false,
    });
    const later = await service.createDemoProduct({
      ...dto,
      sku: dto.sku + '-later',
      sort_order: 2,
      is_published: true,
    });
    const first = await service.createDemoProduct({
      ...dto,
      sku: dto.sku + '-first',
      sort_order: 1,
      is_published: true,
    });
    expect(
      await db.portfolioDemoProduct.findUniqueOrThrow({
        where: { id: hidden.id },
      }),
    ).toMatchObject({ is_published: false, sort_order: -1 });
    expect((await service.listDemoProducts()).map((row) => row.id)).toEqual([
      hidden.id,
      first.id,
      later.id,
    ]);
    expect((await service.publicDemoProducts()).map((row) => row.id)).toEqual([
      first.id,
      later.id,
    ]);
    expect(
      await service.updateDemoProduct(hidden.id, {
        ...dto,
        sort_order: 0,
        is_published: true,
      }),
    ).toMatchObject({ id: hidden.id, sort_order: 0, is_published: true });
    expect(
      await db.portfolioDemoProduct.findUniqueOrThrow({
        where: { id: hidden.id },
      }),
    ).toMatchObject({ sort_order: 0, is_published: true });
    expect((await service.publicDemoProducts()).map((row) => row.id)).toEqual([
      hidden.id,
      first.id,
      later.id,
    ]);
    expect(await service.removeDemoProduct(first.id)).toEqual({
      success: true,
    });
    expect(
      await db.portfolioDemoProduct.count({ where: { id: first.id } }),
    ).toBe(0);
    for (const request of [
      () => service.updateDemoProduct(first.id, dto),
      () => service.removeDemoProduct(first.id),
    ]) {
      const error = await request().catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.getStatus()).toBe(404);
      expect(error.message).toBe('Portfolio record not found');
      expect(await db.portfolioDemoProduct.count()).toBe(2);
    }
  });

  it('[BE-CMS-106] {PortfolioContentService.getSettings} {PortfolioContentService.updateSettings} {PortfolioContentService.publicContent} settings upsert one singleton and aggregate published rows', async () => {
    expect(await service.getSettings()).toBeNull();
    const dto = {
      site_name: 'PosBuzz',
      title: 'Point of sale',
      description: 'Sales and stock',
      url: 'https://example.test',
      og_image: '/logo.png',
      author: 'Team',
      contact_email: 'contact@example.test',
      sales_email: 'sales@example.test',
      phone: '123',
      keywords: ['POS'],
    };
    expect(await service.updateSettings(dto)).toMatchObject({ id: 1, ...dto });
    await service.updateSettings({ ...dto, title: 'Updated' });
    expect(await db.portfolioSetting.count()).toBe(1);
    expect(await service.getSettings()).toMatchObject({ title: 'Updated' });
    await service.createFaq({
      question: 'Visible?',
      answer: 'Yes',
      aeo_summary: 'Yes',
      category: 'general',
      is_published: true,
    });
    await service.createFaq({
      question: 'Hidden?',
      answer: 'No',
      aeo_summary: 'No',
      category: 'general',
      is_published: false,
    });
    expect(await service.publicContent()).toMatchObject({
      settings: { title: 'Updated' },
      solutions: [],
      features: [],
      pricing_plans: [],
      testimonials: [],
      demo_products: [],
      faqs: [{ question: 'Visible?' }],
    });
  });
});
