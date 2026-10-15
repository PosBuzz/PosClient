import { Module } from '@nestjs/common';
import { ReceiptModule } from '../receipt-pdf/receipt.module';
import { InventoryAdjustmentController } from './controllers/inventory-adjustment.controller';
import { InventoryBatchController } from './controllers/inventory-batch.controller';
import { InventoryTransferController } from './controllers/inventory-transfer.controller';
import { InventoryController } from './controllers/inventory.controller';
import { InventoryAdjustmentService } from './services/inventory-adjustment.service';
import { InventoryBatchService } from './services/inventory-batch.service';
import { InventoryHelperService } from './services/inventory-helper.service';
import { InventoryTransferService } from './services/inventory-transfer.service';
import { InventoryService } from './services/inventory.service';

@Module({
  imports: [ReceiptModule],
  controllers: [
    InventoryController,
    InventoryBatchController,
    InventoryTransferController,
    InventoryAdjustmentController,
  ],
  providers: [
    InventoryService,
    InventoryBatchService,
    InventoryTransferService,
    InventoryAdjustmentService,
    InventoryHelperService,
  ],
  exports: [InventoryService],
})
export class InventoryModule {}
