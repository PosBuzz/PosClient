import { Module } from '@nestjs/common';
import { AdminPortfolioController } from './controllers/admin-portfolio.controller';
import { PublicPortfolioController } from './controllers/public-portfolio.controller';
import { PortfolioContentService } from './services/portfolio-content.service';
import { PortfolioLeadService } from './services/portfolio-lead.service';

@Module({
  controllers: [PublicPortfolioController, AdminPortfolioController],
  providers: [PortfolioContentService, PortfolioLeadService],
})
export class PortfolioModule {}
