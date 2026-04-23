import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ClientAuthGuard } from '../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { HasPermissions } from '../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../auth/enums/consumerPermissions.enum';
import { ProductAuditService } from './product-audit.service';
import { ProductAuditPdfService } from './product-audit-pdf.service';
import { ProductAuditQueryDto } from './dto/product-audit-query.dto';

@Controller('consumer/product-audit')
@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.product_audit])
export class ProductAuditController {
  constructor(
    private readonly auditService: ProductAuditService,
    private readonly pdfService: ProductAuditPdfService,
  ) {}

  @Get()
  async getAuditData(
    @Req() req: Request,
    @Query() query: ProductAuditQueryDto,
  ) {
    return this.auditService.getAuditData(
      Number(req.user.consumer_id),
      query,
    );
  }

  @Get('pdf')
  async downloadPdf(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: ProductAuditQueryDto,
  ) {
    const data = await this.auditService.getAuditData(
      Number(req.user.consumer_id),
      query,
    );

    const pdfBuffer = await this.pdfService.generatePdf(data);

    const variantName = (data.meta.variant.name as string)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 30);
    const filename = `audit-${variantName}-${query.start_date}-to-${query.end_date}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    res.send(pdfBuffer);
  }
}
