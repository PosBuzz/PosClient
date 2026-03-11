import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class InventoryHelperService {
  private readonly logger = new Logger(InventoryHelperService.name);
  constructor(private prisma: PrismaService) {} /**
   * Get warehouse branch for a consumer
   */
  async getWarehouseBranch(consumerId: number) {
    try {
      return await this.prisma.branch.findFirst({
        where: {
          consumer_id: consumerId,
          is_warehouse: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error finding warehouse branch for consumer ${consumerId}`, error.stack);
      throw new HttpException(
        'Failed to find warehouse branch',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get standardized location name for display
   */
  getLocationName(branch: {
    id: number;
    name: string;
    is_warehouse?: boolean;
  }): string {
    if (branch.is_warehouse || branch.name === 'Warehouse') {
      return 'Warehouse';
    }
    return branch.name;
  }

  /**
   * Get location description for transactions
   */
  getLocationDescription(branch: {
    id: number;
    name: string;
    is_warehouse?: boolean;
  }): string {
    if (branch.is_warehouse || branch.name === 'Warehouse') {
      return 'Central Warehouse';
    }
    return `Branch: ${branch.name}`;
  }

  /**
   * Check if a branch is warehouse
   */
  isWarehouse(branch: { is_warehouse?: boolean; name?: string }): boolean {
    return branch.is_warehouse === true || branch.name === 'Warehouse';
  }

  /**
   * Generate batch number for adjustments
   */
  generateAdjustmentBatchNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    return `ADJ-${timestamp}`;
  }

  /**
   * Generate batch number for transfers
   */
  generateTransferBatchNumber(): string {
    const timestamp = Date.now().toString().slice(-8);
    return `TRF-${timestamp}`;
  }
}
