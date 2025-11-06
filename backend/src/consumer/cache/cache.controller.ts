import { Controller, Delete, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CacheService } from '../../common/services/cache.service';
import { ClientAuthGuard } from '../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { HasPermissions } from '../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../auth/enums/consumerPermissions.enum';

@Controller('consumer/cache')
@UseGuards(ClientAuthGuard, PermissionsGuard)
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Delete('invalidate-all')
  @HttpCode(HttpStatus.OK)
  @HasPermissions([ConsumerPermission.users]) // Only users with user management permission can clear all caches
  async invalidateAllConsumerCaches(@Req() req: Request) {
    const consumerId = req.user?.consumer_id;
    
    if (!consumerId) {
      throw new Error('Consumer ID not found in request');
    }

    // Get keys count before invalidation for reporting
    const beforeKeys = await this.cacheService.getKeysByPattern(`${consumerId}:*`);
    
    await this.cacheService.invalidateConsumerCache(consumerId);
    
    return {
      success: true,
      message: 'All consumer caches invalidated successfully',
      invalidated_keys_count: beforeKeys.length,
      timestamp: new Date().toISOString(),
    };
  }
}
