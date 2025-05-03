import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { BillingService } from './billing.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('admin/billing')
export class BillingController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly billingService: BillingService,
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
        await this.billingService.generateBillingHistoryPdf(consumer);

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
        await this.billingService.generateBillingHistoryExcel(consumer);

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
      throw new HttpException(
        {
          message: 'Failed to generate billing history Excel',
          error,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
