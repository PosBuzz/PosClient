import { Controller, Get, Query, UseGuards, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProductAuditService } from '../services/product-audit.service';
import { GetProductAuditDto } from '../dto/get-product-audit.dto';
import { ConsumerPermission } from 'src/auth/enums/consumerPermissions.enum';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { ClientAuthGuard } from 'src/auth/guards/client.auth.guard';

@Controller('consumer/inventory/audit')
@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.product_audit])
export class ProductAuditController {
  constructor(private readonly productAuditService: ProductAuditService) {}

  // 1. JSON Data endpoint for UI
  @Get()
  async getAuditData(@Req() req: Request, @Query() query: GetProductAuditDto) {
    // We extract the logic into a separate method in the service so we can reuse it
    return this.productAuditService.getAuditData(
      Number(req?.user.consumer_id),
      query,
    );
  }

  // 2. PDF Download endpoint
  @Get('pdf')
  async getAuditPdf(@Req() req: Request, @Query() query: GetProductAuditDto, @Res() res: Response) {
    try {
      const pdfBuffer = await this.productAuditService.generateAuditReport(
        Number(req?.user.consumer_id),
        query,
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="audit-variant-${query.variant_id}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.end(pdfBuffer);
    } catch (error) {
      throw error;
    }
  }
}