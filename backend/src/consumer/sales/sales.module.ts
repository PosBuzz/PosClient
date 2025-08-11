import { Module } from '@nestjs/common';
import { SalesService } from './services/sales.service';
import { ThermalPrinterService } from './services/thermal-printer.service';
import { SalesPdfService } from './services/sales-pdf.service';
import { SalesController } from './controllers/sales.controller';
import { ThermalPrinterController } from './controllers/thermal-printer.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SalesController, ThermalPrinterController],
  providers: [SalesService, ThermalPrinterService, SalesPdfService],
  exports: [SalesService, ThermalPrinterService, SalesPdfService],
})
export class SalesModule {}
