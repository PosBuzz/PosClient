import { Module } from '@nestjs/common';
import { ProductAuditController } from './controllers/product-audit.controller';
import { ProductAuditPdfService } from './services/product-audit-pdf.service';
import { ProductAuditService } from './services/product-audit.service';

@Module({
  controllers: [ProductAuditController],
  providers: [ProductAuditService, ProductAuditPdfService],
})
export class ProductAuditModule {}
