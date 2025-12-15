/* eslint-disable */

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { UpdateCrudDto } from './dto/update-crud.dto';
import { generateCacheKey } from '../../constants/cache-keys';

@Injectable()
export class CrudService {
  constructor(
    private readonly prismaService: PrismaService,
    private cacheService: CacheService,
  ) {}  //TODO add type of the body based on the model
  async create(body: any, model: string) {
    // console.log(body);
    const result = await this.prismaService[model].create({
      data: body,
    });

    // Invalidate related caches
    await this.invalidateCrudCaches(model);

    return result;
  }  async findAll(model: string) {
    const cacheKey = generateCacheKey.adminCrudList(model);
    
    return this.cacheService.getOrSet(cacheKey, async () => {
      return await this.prismaService[model].findMany({
        orderBy: {
          id: 'asc',
        },
      });
    });
  }  async findOne(id: number, model: string) {
    const cacheKey = generateCacheKey.adminCrudDetail(model, id);
    
    return this.cacheService.getOrSet(cacheKey, async () => {
      return await this.prismaService[model].findFirst({ where: { id } });
    });
  }
  async update(id: number, updateCrudDto: UpdateCrudDto, model: string) {
    const result = await this.prismaService[model].update({
      where: { id },
      data: updateCrudDto,
    });

    // Invalidate related caches
    await this.invalidateCrudCaches(model, id);

    return result;
  }
  async remove(id: number, model: string) {
    try {
      await this.prismaService[model].delete({ where: { id } });
      
      // Invalidate related caches
      await this.invalidateCrudCaches(model, id);
    } catch (e) {
      throw new HttpException(
        { message: 'failed', error: e },
        HttpStatus.EXPECTATION_FAILED,
      );
    }
    return { success: true };
  }

  async findAllByWhere(model: string, body: any) {
    let findClause: any = {};
    if (body.where) {
      findClause.where = body.where;
    }
    if (body.include) {
      findClause.include = body.include;
    }
    findClause.orderBy = {
      id: 'asc',
    };

    if (body.orderBy) {
      findClause.orderBy = body.orderBy;
    }

    return this.prismaService[model].findMany(findClause);
  }

  async search(query, model: string, data: any) {
    const whereClause: any = {};
    const search = data?.map((item) => {
      return {
        [item?.value]: { contains: query, mode: 'insensitive' },
      };
    });
    if (search.length) {
      whereClause.OR = search;
    }

    const searchResults = await this.prismaService[model].findMany({
      where: whereClause,
      orderBy: { id: 'asc' },
    });

    return searchResults;
  }
  // Cache invalidation helper methods
  private async invalidateCrudCaches(model: string, id?: number) {
    const cacheKeysToInvalidate: string[] = [];

    // Invalidate list cache
    cacheKeysToInvalidate.push(generateCacheKey.adminCrudList(model));

    // Invalidate specific item cache if ID is provided
    if (id) {
      cacheKeysToInvalidate.push(generateCacheKey.adminCrudDetail(model, id));
    }

    await Promise.all(
      cacheKeysToInvalidate.map(key => this.cacheService.del(key))
    );

    // Invalidate global caches based on model type
    // billing_logs affect consumer subdomain validation (billing status check)
    if (model === 'BillingHistory') {
      await this.cacheService.invalidateGlobalConsumerCaches();
    }
    
    // Consumer changes affect subdomain validation and consumer details
    if (model === 'Consumer') {
      await this.cacheService.invalidateGlobalConsumerCaches();
    }
    
    // Plan changes affect plan lists and related data
    if (model === 'Plan') {
      await this.cacheService.invalidateGlobalPlanCaches();
    }
  }
}
