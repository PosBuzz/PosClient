import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { BillingInvoicesService } from './billing-invoices.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { AdminPermission } from 'src/auth/enums/adminPermissions.enum';
import { AdminAuthGuard } from 'src/auth/guards/admin.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';

@HasPermissions([AdminPermission.billing])
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('admin/billing')
export class BillingInvoicesController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly billingInvoicesService: BillingInvoicesService,
  ) {}

  @Get('history/pdf/:consumerId')
  async getBillingHistoryPdf(
    @Param('consumerId') consumerId: string,
    @Res() res: Response,
  ) {
    try {
      // Fetch consumer data with users and billing logs
      const consumer = await this.prismaService.consumer.findUnique({
        where: { id: Number(consumerId) },
        include: {
          users: {
            where: {
              role: {
                name: 'Admin',
              },
            },
            select: {
              name: true,
              role: true,
            },
          },
          billing_logs: true,
        },
      });

      if (!consumer) {
        throw new NotFoundException(`Consumer with ID ${consumerId} not found`);
      }

      // Generate PDF
      const pdfBuffer =
        await this.billingInvoicesService.generateBillingHistoryPdf(consumer);

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${consumer.company_name.replace(/[^a-zA-Z0-9]/g, '_')}-Billing-History.pdf"`,
      );
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

      // Send the PDF
      res.send(pdfBuffer);
    } catch (error) {
      throw new HttpException(
        {
          message: 'Failed to generate billing history PDF',
          error,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('history/excel/:consumerId')
  async downloadExcel(
    @Param('consumerId') consumerId: string,
    @Res() res: Response,
  ) {
    try {
      const consumer = await this.prismaService.consumer.findUnique({
        where: { id: Number(consumerId) },
        include: {
          users: {
            where: {
              role: {
                name: 'Admin',
              },
            },
            select: {
              name: true,
              role: true,
            },
          },
          billing_logs: true,
        },
      });

      if (!consumer) {
        throw new NotFoundException(`Consumer with ID ${consumerId} not found`);
      }

      const buffer =
        await this.billingInvoicesService.generateBillingHistoryExcel(consumer);

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${consumer.company_name}-billing-history.xlsx"`,
      );
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      res.send(buffer);
    } catch (error) {
      console.log(error);

      throw new HttpException(
        {
          message: 'Failed to generate billing history Excel',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
