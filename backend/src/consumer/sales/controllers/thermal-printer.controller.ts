import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ThermalPrinterService, PrinterSettings } from '../services/thermal-printer.service';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { Request } from 'express';

interface PrinterSettingsDto {
  printerName?: string;
  paperWidth?: number;
  encoding?: string;
  autocut?: boolean;
  buzzer?: boolean;
}

interface BulkPrintResult {
  saleId: number;
  success: boolean;
  message: string;
  receiptData?: string;
}

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.sales])
@Controller('consumer/thermal-printer')
export class ThermalPrinterController {
  constructor(private readonly thermalPrinterService: ThermalPrinterService) {}

  @Post('print-receipt/:saleId')
  async printSalesReceipt(
    @Param('saleId', ParseIntPipe) saleId: number,
    @Req() req: Request,
    @Body() printerSettings?: PrinterSettingsDto,
  ) {
    const consumerId = req.user?.consumer_id;
    return this.thermalPrinterService.printSalesReceipt(
      saleId,
      consumerId!,
      printerSettings,
    );
  }

  @Get('preview-receipt/:saleId')
  async previewReceipt(
    @Param('saleId', ParseIntPipe) saleId: number,
    @Req() req: Request,
    @Query() printerSettings?: PrinterSettingsDto,
  ) {
    const consumerId = req.user?.consumer_id;
    // Get the receipt data without actually printing
    const result = await this.thermalPrinterService.printSalesReceipt(
      saleId,
      consumerId!,
      printerSettings,
    );

    return {
      success: true,
      message: 'Receipt preview generated',
      receiptData: result.receiptData,
    };
  }

  @Post('test-print')
  async testPrint(@Body() printerSettings?: PrinterSettingsDto) {
    return this.thermalPrinterService.testPrint(printerSettings);
  }

  @Get('settings')
  getDefaultSettings(): { success: boolean; data: PrinterSettings } {
    return {
      success: true,
      data: this.thermalPrinterService.getDefaultSettings(),
    };
  }

  @Post('settings')
  updateSettings(@Body() settings: PrinterSettingsDto): { 
    success: boolean; 
    message: string; 
    data: PrinterSettings 
  } {
    const updatedSettings = this.thermalPrinterService.updateSettings(settings);
    return {
      success: true,
      message: 'Printer settings updated successfully',
      data: updatedSettings,
    };
  }

  @Post('print-receipt/:saleId/reprint')
  async reprintReceipt(
    @Param('saleId', ParseIntPipe) saleId: number,
    @Req() req: Request,
    @Body() printerSettings?: PrinterSettingsDto,
  ) {
    const consumerId = req.user?.consumer_id;
    return this.thermalPrinterService.printSalesReceipt(
      saleId,
      consumerId!,
      printerSettings,
    );
  }

  @Post('bulk-print')
  async bulkPrint(
    @Req() req: Request,
    @Body() body: { saleIds: number[]; printerSettings?: PrinterSettingsDto },
  ) {
    const consumerId = req.user?.consumer_id;
    const { saleIds, printerSettings } = body;
    const results: BulkPrintResult[] = [];

    for (const saleId of saleIds) {
      try {
        const result = await this.thermalPrinterService.printSalesReceipt(
          saleId,
          consumerId!,
          printerSettings,
        );
        results.push({ saleId, ...result });
      } catch (error) {
        results.push({
          saleId,
          success: false,
          message: error.message || 'Failed to print receipt',
        });
      }
    }

    return {
      success: true,
      message: 'Bulk printing completed',
      results,
    };
  }
}
