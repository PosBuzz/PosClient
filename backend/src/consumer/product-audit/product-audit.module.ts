import { Module } from '@nestjs/common';
import { ProductAuditController } from './product-audit.controller';
import { ProductAuditService } from './product-audit.service';
import { ProductAuditPdfService } from './product-audit-pdf.service';

@Module({
  controllers: [ProductAuditController],
  providers: [ProductAuditService, ProductAuditPdfService],
})
export class ProductAuditModule {}
