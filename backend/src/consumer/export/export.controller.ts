import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ConsumerPermission } from '../../auth/enums/consumerPermissions.enum';
import { ClientAuthGuard } from '../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { HasPermissions } from '../../decorators/hasPermissions.decorator';
import { ExportEntity } from './export.types';
import { ExportService } from './services/export.service';

/** Download the current lists as a spreadsheet (default) or a PDF: ?format=xlsx|pdf */
@Controller('consumer/export')
@UseGuards(ClientAuthGuard, PermissionsGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('products')
  @HasPermissions([ConsumerPermission.view_product])
  products(
    @Req() req: Request,
    @Res() res: Response,
    @Query('format') format?: string,
  ) {
    return this.send('products', req, res, format);
  }

  @Get('customers')
  @HasPermissions([ConsumerPermission.customers])
  customers(
    @Req() req: Request,
    @Res() res: Response,
    @Query('format') format?: string,
  ) {
    return this.send('customers', req, res, format);
  }

  @Get('inventory')
  @HasPermissions([ConsumerPermission.inventory_batches])
  inventory(
    @Req() req: Request,
    @Res() res: Response,
    @Query('format') format?: string,
  ) {
    return this.send('inventory', req, res, format);
  }

  private async send(
    entity: ExportEntity,
    req: Request,
    res: Response,
    format?: string,
  ) {
    const file = await this.exportService.export(
      entity,
      Number(req.user.consumer_id),
      this.exportService.parseFormat(format),
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', file.buffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    return res.send(file.buffer);
  }
}
