import { Controller, Delete, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { CacheService } from '../../common/services/cache.service';
import { AdminAuthGuard } from '../../auth/guards/admin.auth.guard';

@Controller('admin/cache')
@UseGuards(AdminAuthGuard)
export class AdminCacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Delete('invalidate-all')
  @HttpCode(HttpStatus.OK)
  async invalidateAllAdminCaches() {
    // Get keys count before invalidation for reporting
    const beforeKeys = await this.cacheService.getKeysByPattern('global:*');
    
    await this.cacheService.invalidateAllAdminCaches();
    
    return {
      success: true,
      message: 'All admin-related caches invalidated successfully',
      invalidated_keys_count: beforeKeys.length,
      timestamp: new Date().toISOString(),
    };
  }
}
