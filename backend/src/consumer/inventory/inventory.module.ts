import { Module } from '@nestjs/common';
import { InventoryController } from './controllers/inventory.controller';
import { InventoryBatchController } from './controllers/inventory-batch.controller';
import { InventoryTransferController } from './controllers/inventory-transfer.controller';
import { InventoryAdjustmentController } from './controllers/inventory-adjustment.controller';
import { InventoryService } from './services/inventory.service';
import { InventoryBatchService } from './services/inventory-batch.service';
import { InventoryTransferService } from './services/inventory-transfer.service';
import { InventoryAdjustmentService } from './services/inventory-adjustment.service';
import { InventoryHelperService } from './services/inventory-helper.service';

@Module({
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
    InventoryHelperService  ,
  ],
})
export class InventoryModule {}
