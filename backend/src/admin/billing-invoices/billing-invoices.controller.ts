import {
  Logger,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  NotFoundException,
  HttpException,
  HttpStatus,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { errorStack } from '../../common/utils/error.util';
import { isClientError } from '../../common/errors/client-error';
import { BillingInvoicesService } from './billing-invoices.service';
import { BillingHistoryService } from './billing-history.service';
import { CreateBillingHistoryDto } from './dto/create-billing-history.dto';
import { UpdateBillingHistoryDto } from './dto/update-billing-history.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { AdminPermission } from 'src/auth/enums/adminPermissions.enum';
import { AdminAuthGuard } from 'src/auth/guards/admin.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';

@HasPermissions([AdminPermission.billing])
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('admin/billing')
export class BillingInvoicesController {
  private readonly logger = new Logger(BillingInvoicesController.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly billingInvoicesService: BillingInvoicesService,
    private readonly billingHistoryService: BillingHistoryService,
  ) {}

  @Get()
  findAll(
    @Query('consumer_ids') consumerIds?: string,
    @Query('reference') reference?: string,
  ) {
    return this.billingHistoryService.findAll({
      consumerIds: consumerIds
        ? consumerIds
            .split(',')
            .map((v) => Number(v))
            .filter((v) => !Number.isNaN(v))
        : undefined,
      reference,
    });
  }

  @Post()
  create(@Body() dto: CreateBillingHistoryDto) {
    return this.billingHistoryService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBillingHistoryDto,
  ) {
    return this.billingHistoryService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.billingHistoryService.remove(id);
  }

  @Get('history/pdf/:consumerId')
  async getBillingHistoryPdf(
    @Param('consumerId', ParseIntPipe) consumerId: number,
    @Res() res: Response,
  ) {
    try {
      // Fetch consumer data with users and billing logs
      const consumer = await this.prismaService.consumer.findUnique({
        where: { id: consumerId },
        include: {
          users: {
            where: {
              role: {
                name: 'Admin',
                is_admin: true,
              },
            },
            select: {
              name: true,
              role: true,
            },
          },
          billing_logs: {
            include: {
              plan: true,
            },
          },
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
      this.fail(error, 'Failed to generate billing history PDF');
    }
  }

  @Get('invoice/pdf/:billingId')
  async generateInvoicePdf(
    @Param('billingId', ParseIntPipe) billingId: number,
    @Res() res: Response,
  ) {
    try {
      const billing = await this.prismaService.billingHistory.findUnique({
        where: { id: billingId },
        include: {
          consumer: {
            include: {
              users: {
                where: { role: { is_admin: true } },
                select: { name: true, role: true },
              },
            },
          },
          plan: true,
        },
      });

      if (!billing) {
        throw new NotFoundException('Billing history not found');
      }

      // Generate PDF as Buffer
      const pdfBuffer =
        await this.billingInvoicesService.generateInvoicePdf(billing);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `inline; filename=invoice-${billing.reference || billing.id}.pdf`,
      );
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

      res.send(pdfBuffer);
    } catch (error) {
      this.fail(error, 'Failed to generate invoice PDF');
    }
  }

  @Get('history/excel/:consumerId')
  async downloadExcel(
    @Param('consumerId', ParseIntPipe) consumerId: number,
    @Res() res: Response,
  ) {
    try {
      const consumer = await this.prismaService.consumer.findUnique({
        where: { id: consumerId },
        include: {
          users: {
            where: {
              role: {
                name: 'Admin',
                is_admin: true,
              },
            },
            select: {
              name: true,
              role: true,
            },
          },
          billing_logs: {
            include: {
              plan: true,
            },
          },
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
      this.fail(error, 'Failed to generate billing history Excel');
    }
  }

  /** Known problems (not found, bad input) keep their status; anything else is a logged 500 with no internals in the body. */
  private fail(error: unknown, message: string): never {
    if (isClientError(error)) throw error;
    this.logger.error(message, errorStack(error));
    throw new HttpException({ message }, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
