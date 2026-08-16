import { Module } from '@nestjs/common';
import { AdminPortfolioController } from './controllers/admin-portfolio.controller';
import { PublicPortfolioController } from './controllers/public-portfolio.controller';
import { PortfolioRevalidateInterceptor } from './interceptors/portfolio-revalidate.interceptor';
import { PortfolioContentService } from './services/portfolio-content.service';
import { PortfolioLeadService } from './services/portfolio-lead.service';
import { PortfolioRevalidationService } from './services/portfolio-revalidation.service';

@Module({
  controllers: [PublicPortfolioController, AdminPortfolioController],
  providers: [
    PortfolioContentService,
    PortfolioLeadService,
    PortfolioRevalidationService,
    PortfolioRevalidateInterceptor,
  ],
})
export class PortfolioModule {}
