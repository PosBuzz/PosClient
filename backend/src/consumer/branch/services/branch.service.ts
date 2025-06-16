import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';
import { CacheService } from '../../../common/services/cache.service';
import { generateCacheKey, generateCachePatterns } from '../../../constants/cache-keys';

@Injectable()
export class BranchService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly cacheService: CacheService,
  ) {}
  async create(createBranchDto: CreateBranchDto, consumerId: number) {
    // Get count of existing branches
    const branchCount = await this.prismaService.branch.count({
      where: { consumer_id: consumerId }
    });
    
    // If this is the first branch, make it the main branch
    const isMain = branchCount === 0;
    
    const result = await this.prismaService.branch.create({
      data: {
        name: createBranchDto.name,
        address: createBranchDto.address,
        phone: createBranchDto.phone,
        email: createBranchDto.email,
        is_main: isMain,
        consumer_id: consumerId,
      },
    });

    // Invalidate branch caches    // Invalidate caches since branches affect inventory
    await this.cacheService.invalidateAllInventoryCaches(consumerId);

    return result;
  }
  async findAll(consumerId: number) {
    // Generate cache key
    const cacheKey = generateCacheKey.branchList(consumerId);
    
    // Try to get from cache first
    return this.cacheService.getOrSet(cacheKey, async () => {
      return this.prismaService.branch.findMany({
        where: { consumer_id: consumerId },
        orderBy: [
          { is_main: 'desc' }, // Main branch first
          { name: 'asc' }      // Then alphabetically
        ],
      });
    });
  }
  async findOne(id: number, consumerId: number) {
    // Generate cache key
    const cacheKey = generateCacheKey.branchDetail(id, consumerId);
    
    // Try to get from cache first
    return this.cacheService.getOrSet(cacheKey, async () => {
      const branch = await this.prismaService.branch.findFirst({
        where: { 
          id,
          consumer_id: consumerId
        },
      });

      if (!branch) {
        throw new NotFoundException(`Branch with ID ${id} not found`);
      }

      return branch;
    });
  }
  async update(id: number, updateBranchDto: UpdateBranchDto, consumerId: number) {
    // First check if the branch exists and belongs to this consumer
    await this.findOne(id, consumerId);

    const result = await this.prismaService.branch.update({
      where: { id },      data: {
        name: updateBranchDto.name,
        address: updateBranchDto.address,
        phone: updateBranchDto.phone,
        email: updateBranchDto.email,
      },
    });

    // Invalidate caches since branches affect inventory
    await this.cacheService.invalidateAllInventoryCaches(consumerId);

    return result;
  }
  async remove(id: number, consumerId: number) {
    // First check if the branch exists and belongs to this consumer
    const branch = await this.findOne(id, consumerId);
    
    // Can't delete the main branch
    if (branch.is_main) {
      throw new Error('Cannot delete the main branch');
    }    await this.prismaService.branch.delete({
      where: { id },
    });
    
    // Invalidate caches since branches affect inventory
    await this.cacheService.invalidateAllInventoryCaches(consumerId);
    
    return { success: true };
  }
  async setMainBranch(id: number, consumerId: number) {
    // Check if branch exists
    await this.findOne(id, consumerId);
    
    // Start a transaction to update main branch status
    const result = await this.prismaService.$transaction(async (tx) => {
      // First, set all branches to not be main
      await tx.branch.updateMany({
        where: { consumer_id: consumerId },
        data: { is_main: false },
      });
      
      // Then, set the selected branch as main
      return tx.branch.update({
        where: { id },
        data: { is_main: true },
      });
    });

    // Invalidate branch caches since main branch status changed    // Invalidate caches since branches affect inventory
    await this.cacheService.invalidateAllInventoryCaches(consumerId);

    return result;
  }
}