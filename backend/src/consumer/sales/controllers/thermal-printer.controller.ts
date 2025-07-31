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
import { ThermalPrinterService } from '../services/thermal-printer.service';
import { PrinterSettings } from '../../../constants/printer.constants';
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

  @Post('prepare-receipt/:saleId')
  async printSalesReceipt(
    @Param('saleId', ParseIntPipe) saleId: number,
    @Req() req: Request,
    @Body() printerSettings?: PrinterSettingsDto,
  ) {
    const consumerId = req.user?.consumer_id;
    return this.thermalPrinterService.prepareSalesReceipt(
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
    const result = await this.thermalPrinterService.prepareSalesReceipt(
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

  @Get('test-data')
  async getTestReceiptData() {
    return {
      receiptData: this.thermalPrinterService.getTestReceiptData(),
    };
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

  @Post('prepare-receipt/:saleId/reprint')
  async reprintReceipt(
    @Param('saleId', ParseIntPipe) saleId: number,
    @Req() req: Request,
    @Body() printerSettings?: PrinterSettingsDto,
  ) {
    const consumerId = req.user?.consumer_id;
    return this.thermalPrinterService.prepareSalesReceipt(
      saleId,
      consumerId!,
      printerSettings,
    );
  }

  @Post('bulk-prepare')
  async bulkPrepare(
    @Req() req: Request,
    @Body() body: { saleIds: number[]; printerSettings?: PrinterSettingsDto },
  ) {
    const consumerId = req.user?.consumer_id;
    const { saleIds, printerSettings } = body;
    const results: BulkPrintResult[] = [];

    for (const saleId of saleIds) {
      try {
        const result = await this.thermalPrinterService.prepareSalesReceipt(
          saleId,
          consumerId!,
          printerSettings,
        );
        results.push({ 
          saleId, 
          success: result.success,
          message: result.message,
          receiptData: JSON.stringify(result.receiptData, null, 2)
        });
      } catch (error: any) {
        results.push({
          saleId,
          success: false,
          message: error.message || 'Failed to prepare receipt',
        });
      }
    }

    return {
      success: true,
      message: 'Bulk preparation completed',
      results,
    };
  }
}
